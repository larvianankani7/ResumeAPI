import { test } from '@playwright/test';
import Redis from 'ioredis';

test.setTimeout(120000);

test('resume API load test', async ({ request }) => {
  const redis = new Redis(
    process.env.REDIS_URL || 'redis://localhost:6379'
  );

  const email =
    process.env.TEST_EMAIL || 'test@example.com';

  const password =
    process.env.TEST_PASSWORD || 'testpassword123';

  const loginResponse = await request.post(
    '/api/auth/login',
    {
      data: {
        email,
        password
      }
    }
  );

  if (!loginResponse.ok()) {
    throw new Error(
      `Login failed: ${loginResponse.status()}`
    );
  }

  const otp = await redis.get(`otp:${email}`);

  if (!otp) {
    throw new Error('OTP not found in Redis');
  }

  const verifyResponse = await request.post(
    '/api/auth/verify-otp',
    {
      data: {
        email,
        otp
      }
    }
  );

  if (!verifyResponse.ok()) {
    throw new Error(
      `OTP verification failed: ${verifyResponse.status()}`
    );
  }

  const { accessToken } = await verifyResponse.json();

  const headers = {
    Authorization: `Bearer ${accessToken}`
  };

  const latencySamples: number[] = [];

  for (let i = 0; i < 10; i++) {
    const start = performance.now();

    const response = await request.get(
      '/api/network-latency',
      {
        headers
      }
    );

    const body = await response.body();

    const end = performance.now();

    if (!response.ok()) {
      throw new Error(
        `Latency request failed: ${response.status()}`
      );
    }

    void body;

    latencySamples.push(end - start);
  }

  const averageRtt =
    latencySamples.reduce(
      (sum, value) => sum + value,
      0
    ) / latencySamples.length;

  const totalRequests = 10000;

  let successful = 0;
  let failed = 0;
  let resumeSize = 0;

  const backendTimes: number[] = [];

  const start = performance.now();

  const requests = Array.from(
    { length: totalRequests },
    async () => {
      const response = await request.get(
        '/api/auth/login',
        {
          headers
        }
      );

      const backendTime = Number(
        response.headers()[
          'x-backend-processing-time'
        ]
      );

      if (Number.isFinite(backendTime)) {
        backendTimes.push(backendTime);
      }

      if (response.ok()) {
        successful++;

        if (!resumeSize) {
          const body = await response.body();
          resumeSize = body.length;
        }
      } else {
        failed++;
      }
    }
  );

  await Promise.all(requests);

  const end = performance.now();

  const totalDuration =
    (end - start) / 1000;

  const requestsPerSecond =
    totalRequests / totalDuration;

  const averageBackendTime =
    backendTimes.length > 0
      ? backendTimes.reduce(
          (sum, value) => sum + value,
          0
        ) / backendTimes.length
      : 0;

  console.log(
    '\n========== LOAD TEST =========='
  );
  console.log(
    `Total requests:       ${totalRequests}`
  );
  console.log(
    `Successful:            ${successful}`
  );
  console.log(
    `Failed:                ${failed}`
  );
  console.log(
    `Total duration:        ${totalDuration.toFixed(2)} seconds`
  );
  console.log(
    `Requests/sec:          ${requestsPerSecond.toFixed(2)}`
  );
  console.log(
    `Average API RTT:       ${averageRtt.toFixed(2)} ms`
  );
  console.log(
    `Average backend time:  ${averageBackendTime.toFixed(4)} ms`
  );
  console.log(
    `Resume size:           ${resumeSize} bytes`
  );
  console.log(
    '================================\n'
  );

  await redis.quit();
});