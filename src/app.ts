import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { jobRoutes } from './routes/jobs.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { randomUUID } from 'crypto';
import { httpRequestCounter, httpRequestDuration, register } from './lib/metrics.js';

export function buildApp() {
  const app = Fastify({
    logger: true,
    genReqId: () => randomUUID(),
  });

  app.addHook('onRequest', async (request) => {
    (request as any).startTime = process.hrtime.bigint();
  });

  app.addHook('onResponse', async (request, reply) => {
    const startTime = (request as any).startTime as bigint;
    const durationNs = process.hrtime.bigint() - startTime;
    const durationSeconds = Number(durationNs) / 1e9;

    const route = request.routeOptions?.url ?? request.url;
    const labels = { method: request.method, route, status_code: String(reply.statusCode) };

    httpRequestCounter.inc(labels);
    httpRequestDuration.observe(labels, durationSeconds);
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

  app.register(authRoutes);

  return app;
}