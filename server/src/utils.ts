import crypto from 'crypto';
import argon2 from 'argon2';
import { redis } from './redis.js';

export function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

export function passwordFingerprint(password: string) {
  return crypto
    .createHmac('sha256', process.env.PASSWORD_FINGERPRINT_SECRET!)
    .update(password)
    .digest('hex');
}

export async function hashPassword(password: string) {
  return argon2.hash(password, {
    type: argon2.argon2id
  });
}

export async function verifyPassword(hash: string, password: string) {
  return argon2.verify(hash, password);
}

export async function rateLimit(
  key: string,
  limit: number,
  seconds: number
) {
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, seconds);
  }

  return count <= limit;
}

const userRateLimitCapacity = 5;
const userRateLimitIntervalMs = 30_000;

const consumeUserRateLimitScript = `
local capacity = tonumber(ARGV[1])
local refillAmount = tonumber(ARGV[2])
local refillIntervalMs = tonumber(ARGV[3])
local now = tonumber(ARGV[4])
if now == nil then
  local redisTime = redis.call('TIME')
  now = (tonumber(redisTime[1]) * 1000) + math.floor(tonumber(redisTime[2]) / 1000)
end
local tokens = tonumber(redis.call('HGET', KEYS[1], 'tokens'))
local lastRefill = tonumber(redis.call('HGET', KEYS[1], 'lastRefill'))

if tokens == nil then
  tokens = capacity
  lastRefill = now
else
  local elapsed = math.max(0, now - lastRefill)
  local intervals = math.floor(elapsed / refillIntervalMs)

  if intervals > 0 then
    tokens = math.min(capacity, tokens + (intervals * refillAmount))
    lastRefill = lastRefill + (intervals * refillIntervalMs)
  end
end

local allowed = 0
if tokens > 0 then
  tokens = tokens - 1
  allowed = 1
end

local retryAfterMs = 0
if allowed == 0 then
  retryAfterMs = math.max(1, lastRefill + refillIntervalMs - now)
end

redis.call('HSET', KEYS[1], 'tokens', tokens, 'lastRefill', lastRefill)
redis.call('PEXPIRE', KEYS[1], refillIntervalMs * 2)

return { allowed, tokens, math.ceil(retryAfterMs / 1000) }
`;

export async function consumeUserRateLimit(
  userId: string,
  nowMs?: number
) {
  const key = `rate-limit:user:${crypto
    .createHash('sha256')
    .update(userId)
    .digest('hex')}`;

  const [allowed, remaining, retryAfterSeconds] = (await redis.eval(
    consumeUserRateLimitScript,
    1,
    key,
    String(userRateLimitCapacity),
    String(userRateLimitCapacity),
    String(userRateLimitIntervalMs),
    String(nowMs ?? '')
  )) as [number, number, number];

  return {
    allowed: allowed === 1,
    remaining,
    retryAfterSeconds
  };
}