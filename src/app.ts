import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { jobRoutes } from './routes/jobs.js';
import { healthRoutes } from './routes/health.js';

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.register(swagger, {
    openapi: {
      info: {
        title: 'Pulse API',
        version: '1.0.0',
      },
    },
  });

  app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  app.register(jobRoutes);

  app.register(healthRoutes);

  return app;
}