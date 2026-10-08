import { test, expect } from '@playwright/test';
import Redis from 'ioredis';

test('concurrent resume requests', async ({ request }) => {
  test.setTimeout(120000);

  const email = 'larvianankani7@gmail.com';
  const password = '@Larvia5n';

  const login = await request.post('/api/auth/login', {
    data: {
      email,
      password
    }
  });

  console.log('Login status:', login.status());
  console.log('Login response:', await login.text());

  expect(login.ok()).toBeTruthy();

  const redis = new Redis(
    process.env.REDIS_URL || 'redis://localhost:6379'
  );

  const otp = await redis.get(`otp:${email}`);

  await redis.quit();

  if (!otp) {
    throw new Error('OTP not found in Redis');
  }

  console.log('OTP retrieved from Redis.');

  const verify = await request.post('/api/auth/verify-otp', {
    data: {
      email,
      otp
    }
  });

  console.log('OTP verification status:', verify.status());

  expect(verify.ok()).toBeTruthy();

  const tokens = await verify.json();
  const accessToken = tokens.accessToken;

  console.log('Authentication successful.');
  console.log('Starting concurrent resume requests...');

  const start = Date.now();

  const requests = Array.from({ length: 10000 }, (_, index) =>
    request
      .get('/api/resume', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })
      .then(async response => {
        const body = await response.body();

        return {
          index,
          status: response.status(),
          size: body.length
        };
      })
  );

  const results = await Promise.all(requests);

  const duration = Date.now() - start;

  const successful = results.filter(
    result => result.status === 200
  );

  const failed = results.filter(
    result => result.status !== 200
  );

  console.log('\n========== LOAD TEST ==========');
  console.log('Total requests:', results.length);
  console.log('Successful:', successful.length);
  console.log('Failed:', failed.length);
  console.log('Duration:', `${duration} ms`);
  console.log(
    'Requests/sec:',
    (results.length / (duration / 1000)).toFixed(2)
  );
  console.log(
    'Resume size:',
    successful.length
      ? `${successful[0].size} bytes`
      : 'N/A'
  );
  console.log('================================\n');

  if (failed.length) {
    console.log('Failed responses:');
    console.log(failed.slice(0, 20));
  }

  expect(failed.length).toBe(0);
  expect(successful.length).toBe(10000);
});