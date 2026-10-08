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