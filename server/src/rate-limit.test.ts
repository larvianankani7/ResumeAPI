import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { redis } from './redis.js';
import { resumeRoutes } from './resume.js';
import { consumeUserRateLimit } from './utils.js';

const app = Fastify();

await app.register(jwt, {
  secret: 'rate-limit-test-secret'
});
await app.register(resumeRoutes);
await app.ready();

after(async () => {
  await app.close();
  await redis.quit();
});

test('token bucket refills atomically and isolates users', async () => {
  await redis.ping();

  const userId = `test-${randomUUID()}`;
  const otherUserId = `test-${randomUUID()}`;
  const simultaneousRequests = await Promise.all(
    Array.from(
      { length: 8 },
      () => consumeUserRateLimit(userId, 100_000)
    )
  );

  assert.equal(
    simultaneousRequests.filter(result => result.allowed).length,
    5
  );
  assert.equal(
    simultaneousRequests.filter(result => !result.allowed).length,
    3
  );

  const refilledRequests = await Promise.all(
    Array.from(
      { length: 6 },
      () => consumeUserRateLimit(userId, 130_000)
    )
  );

  assert.equal(
    refilledRequests.filter(result => result.allowed).length,
    5
  );
  assert.equal(
    refilledRequests.find(result => !result.allowed)?.retryAfterSeconds,
    30
  );

  const otherUserRequests = await Promise.all(
    Array.from(
      { length: 5 },
      () => consumeUserRateLimit(otherUserId, 130_000)
    )
  );

  assert.equal(otherUserRequests.every(result => result.allowed), true);
});

test('protected routes reject unauthenticated and over-limit requests', async () => {
  const unauthorized = await app.inject({
    method: 'GET',
    url: '/api/network-latency'
  });

  assert.equal(unauthorized.statusCode, 401);

  const userId = `route-test-${randomUUID()}`;
  const refreshToken = app.jwt.sign({
    sub: userId,
    type: 'refresh'
  });
  const refreshResponse = await app.inject({
    method: 'GET',
    url: '/api/network-latency',
    headers: {
      authorization: `Bearer ${refreshToken}`
    }
  });

  assert.equal(refreshResponse.statusCode, 401);

  const accessToken = app.jwt.sign({ sub: userId });
  const responses = await Promise.all(
    Array.from({ length: 6 }, () =>
      app.inject({
        method: 'GET',
        url: '/api/network-latency',
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      })
    )
  );

  assert.equal(
    responses.filter(response => response.statusCode === 200).length,
    5
  );

  const rejected = responses.find(response => response.statusCode === 429);
  assert.ok(rejected);
  assert.ok(Number(rejected.headers['retry-after']) > 0);
});