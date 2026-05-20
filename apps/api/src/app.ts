import Fastify from 'fastify';
import { config } from './core/config.js';
import { loggerOptions } from './core/logger.js';
import { registerCorePlugins } from './plugins/index.js';
import { registerGraphQL } from './graphql/index.js';
import { registerWsRoutes } from './modules/ws/routes.js';
import { registerStudyMaterialRoutes } from './modules/studyMaterial/routes.js';
import { AppError } from './core/errors.js';

// Eagerly bind analytics event listeners.
import './core/analytics.js';

export async function buildApp() {
  const app = Fastify({
    logger: loggerOptions,
    trustProxy: true,
    disableRequestLogging: false,
    bodyLimit: 5 * 1024 * 1024,
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      reply.code(err.statusCode).send({
        error: err.code,
        message: err.message,
        details: err.details ?? null,
      });
      return;
    }
    req.log.error({ err }, 'Unhandled error');
    const statusCode =
      typeof (err as { statusCode?: number }).statusCode === 'number'
        ? (err as { statusCode: number }).statusCode
        : 500;
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    reply.code(statusCode).send({
      error: 'INTERNAL',
      message: config.NODE_ENV === 'production' ? 'Internal server error' : message,
    });
  });

  await registerCorePlugins(app);

  app.get('/health', async () => ({ status: 'ok', uptime: process.uptime() }));

  await registerGraphQL(app);
  await registerWsRoutes(app);
  await registerStudyMaterialRoutes(app);

  return app;
}
