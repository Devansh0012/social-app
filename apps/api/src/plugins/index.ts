import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import websocket from '@fastify/websocket';
import { config } from '../core/config.js';
import { accessTokenSecret } from '../core/auth/jwt.js';

export async function registerCorePlugins(app: FastifyInstance): Promise<void> {
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: config.CORS_ORIGIN.split(',').map((s) => s.trim()),
    credentials: true,
  });
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW,
  });
  await app.register(jwt, {
    secret: accessTokenSecret,
    sign: { algorithm: 'HS256' },
  });
  await app.register(multipart, {
    limits: { fileSize: 25 * 1024 * 1024 },
  });
  await app.register(websocket);

  if (config.STORAGE_DRIVER === 'local') {
    const root = path.resolve(config.STORAGE_LOCAL_DIR);
    const prefix = config.STORAGE_PUBLIC_PREFIX.startsWith('/')
      ? config.STORAGE_PUBLIC_PREFIX
      : `/${config.STORAGE_PUBLIC_PREFIX}`;
    await app.register(staticPlugin, {
      root,
      prefix: `${prefix}/`,
      decorateReply: false,
    });
  }
}
