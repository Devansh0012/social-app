import type { FastifyServerOptions } from 'fastify';
import { config } from './config.js';

export const loggerOptions: FastifyServerOptions['logger'] =
  config.NODE_ENV === 'development'
    ? {
        level: config.LOG_LEVEL,
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
        },
      }
    : { level: config.LOG_LEVEL };
