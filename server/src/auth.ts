import { FastifyInstance } from 'fastify';
import nodemailer from 'nodemailer';
import { eq } from 'drizzle-orm';
import { db, users } from './db.js';
import { redis } from './redis.js';
import {
  generateOtp,
  hashPassword,
  passwordFingerprint,
  rateLimit,
  verifyPassword
} from './utils.js';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/login', async (request, reply) => {
    const { email, password } = request.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      return reply.code(400).send({
        error: 'Email and password are required'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return reply.code(400).send({
        error: 'Invalid email'
      });
    }

    if (password.length < 8) {
      return reply.code(400).send({
        error: 'Password must be at least 8 characters'
      });
    }

    if (!(await rateLimit(`login:ip:${request.ip}`, 10, 60))) {
      return reply.code(429).send({
        error: 'Too many login requests'
      });
    }

    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingUser.length) {
      const user = existingUser[0];

      const valid = await verifyPassword(
        user.passwordHash,
        password
      );

      if (!valid) {
        return reply.code(401).send({
          error: 'Invalid email or password'
        });
      }
    } else {
      const fingerprint = passwordFingerprint(password);

      const existingPassword = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.passwordFingerprint, fingerprint))
        .limit(1);

      if (existingPassword.length) {
        return reply.code(409).send({
          error: 'This password has already been used'
        });
      }

      const passwordHash = await hashPassword(password);

      try {
        await db.insert(users).values({
          email: normalizedEmail,
          passwordHash,
          passwordFingerprint: fingerprint
        });
      } catch {
        return reply.code(409).send({
          error: 'Account already exists'
        });
      }
    }

    const otp = generateOtp();

    await redis.set(
      `otp:${normalizedEmail}`,
      otp,
      'EX',
      300
    );

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: normalizedEmail,
      subject: 'Your Resume API OTP',
      text: `Your OTP is ${otp}. It expires in 5 minutes.`
    });

    return {
      message: 'OTP sent'
    };
  });

  app.post('/api/auth/verify-otp', async (request, reply) => {
    const { email, otp } = request.body as {
      email?: string;
      otp?: string;
    };

    if (!email || !otp) {
      return reply.code(400).send({
        error: 'Email and OTP are required'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!(await rateLimit(
      `otp:verify:${normalizedEmail}`,
      5,
      600
    ))) {
      return reply.code(429).send({
        error: 'Too many OTP attempts'
      });
    }

    const storedOtp = await redis.get(
      `otp:${normalizedEmail}`
    );

    if (!storedOtp || storedOtp !== otp) {
      return reply.code(401).send({
        error: 'Invalid or expired OTP'
      });
    }

    await redis.del(`otp:${normalizedEmail}`);

    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!result.length) {
      return reply.code(401).send({
        error: 'User not found'
      });
    }

    const user = result[0];

    await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, user.id));

    const accessToken = app.jwt.sign(
      { sub: String(user.id) },
      { expiresIn: '15m' }
    );

    const refreshToken = app.jwt.sign(
      {
        sub: String(user.id),
        type: 'refresh'
      },
      { expiresIn: '7d' }
    );

    await redis.set(
      `refresh:${user.id}`,
      refreshToken,
      'EX',
      604800
    );

    return {
      accessToken,
      refreshToken
    };
  });

  app.post('/api/auth/refresh', async (request, reply) => {
    const { refreshToken } = request.body as {
      refreshToken?: string;
    };

    if (!refreshToken) {
      return reply.code(401).send({
        error: 'Refresh token required'
      });
    }

    try {
      const decoded = app.jwt.verify<{
        sub: string;
        type: string;
      }>(refreshToken);

      if (decoded.type !== 'refresh') {
        throw new Error();
      }

      const stored = await redis.get(
        `refresh:${decoded.sub}`
      );

      if (stored !== refreshToken) {
        throw new Error();
      }

      const accessToken = app.jwt.sign(
        { sub: decoded.sub },
        { expiresIn: '15m' }
      );

      return { accessToken };
    } catch {
      return reply.code(401).send({
        error: 'Invalid refresh token'
      });
    }
  });
}