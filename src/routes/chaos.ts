import type { FastifyInstance } from 'fastify';
import { connection } from '../lib/redis.js';
import { authenticate, requireRole } from '../lib/auth.js';
import { chaosSchema } from '../schema/chaos.schema.js';

export async function chaosRoutes(app: FastifyInstance) {
  app.post(
    '/chaos/:service',
    {
      schema: chaosSchema,
      preHandler: [authenticate, requireRole('ADMIN')],
    },
    async (request, reply) => {
      const { service } = request.params as { service: string };
      const { failureRate, latencyMs } = request.body as { failureRate?: number; latencyMs?: number };

      if (failureRate !== undefined) {
        await connection.set(`chaos:${service}:failureRate`, failureRate);
      }

      if (latencyMs !== undefined) {
        await connection.set(`chaos:${service}:latencyMs`, latencyMs);
      }

      return { service, failureRate, latencyMs };
    }
  );

  app.get(
    '/chaos/:service',
    { schema: { params: chaosSchema.params }, preHandler: [authenticate, requireRole('ADMIN')] },
    async (request) => {
      const { service } = request.params as { service: string };

      const [failureRate, latencyMs] = await Promise.all([
        connection.get(`chaos:${service}:failureRate`),
        connection.get(`chaos:${service}:latencyMs`),
      ]);

      return {
        service,
        failureRate: failureRate ? Number(failureRate) : 0,
        latencyMs: latencyMs ? Number(latencyMs) : 200,
      };
    }
  );
}