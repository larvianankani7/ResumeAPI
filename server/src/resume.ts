import { FastifyInstance } from 'fastify';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { redis } from './redis.js';

const resumePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../resume.pdf'
);

let memoryCache: Buffer | null = null;
let loadingResume: Promise<Buffer> | null = null;

let memoryHits = 0;
let redisHits = 0;
let diskReads = 0;
let singleFlightWaits = 0;

async function loadResume() {
  if (memoryCache) {
    memoryHits++;
    return memoryCache;
  }

  const cached = await redis.getBuffer('resume:pdf');

  if (cached) {
    redisHits++;
    memoryCache = cached;
    return cached;
  }

  if (loadingResume) {
    singleFlightWaits++;
    return loadingResume;
  }

  loadingResume = (async () => {
    diskReads++;

    const file = await fs.readFile(resumePath);

    await redis.set('resume:pdf', file);

    memoryCache = file;

    return file;
  })();

  try {
    return await loadingResume;
  } finally {
    loadingResume = null;
  }
}

export async function resumeRoutes(app: FastifyInstance) {
  app.get('/api/resume', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({
        error: 'Unauthorized'
      });
    }

    const resume = await loadResume();

    return reply
      .type('application/pdf')
      .header(
        'Content-Disposition',
        'attachment; filename="resume.pdf"'
      )
      .header('Cache-Control', 'private, max-age=300')
      .send(resume);
  });

  app.get('/api/resume/stats', async () => {
    return {
      memoryHits,
      redisHits,
      diskReads,
      singleFlightWaits
    };
  });
}