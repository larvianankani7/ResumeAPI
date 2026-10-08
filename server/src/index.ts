import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { authRoutes } from './auth.js';
import { resumeRoutes } from './resume.js';

const app = Fastify({
  logger: true
});

await app.register(cors, {
  origin: 'http://localhost:5173'
});

await app.register(jwt, {
  secret: process.env.JWT_SECRET || 'secret'
});

app.get('/', async () => {
  return {
    name: 'Resume API',
    status: 'ok'
  };
});

await authRoutes(app);
await resumeRoutes(app);

await app.listen({
  port: 3000,
  host: '0.0.0.0'
});