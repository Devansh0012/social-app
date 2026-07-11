import { PrismaClient } from '@prisma/client';
import { config } from './config.js';

declare global {
  // eslint-disable-next-line no-var
  var __braventexPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__braventexPrisma ??
  new PrismaClient({
    log:
      config.NODE_ENV === 'development'
        ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
        : ['warn', 'error'],
  });

if (config.NODE_ENV !== 'production') {
  globalThis.__braventexPrisma = prisma;
}
