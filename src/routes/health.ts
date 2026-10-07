import type { FastifyInstance } from 'fastify';
import { connection } from '../lib/redis.js';
import { queueDepthGauge, register } from '../lib/metrics.js';
import { jobQueue } from '../lib/queue.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    return { status: 'ok' };
  });

  app.get('/health/circuit-breakers', async () => {
    const services = ['customer', 'payment', 'notification'];

    const results = await Promise.all(
      services.map(async (name) => {
        const raw = await connection.get(`metrics:${name}`);
        return [name, raw ? JSON.parse(raw) : { state: 'Closed', totalCalls: 0, totalFailures: 0 }];
      })
    );

    return Object.fromEntries(results);
  });

  app.get('/metrics', async (request, reply) => {
    const counts = await jobQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');

    for (const [state, count] of Object.entries(counts)) {
      queueDepthGauge.set({ state }, count);
    }

    reply.header('Content-Type', register.contentType);
    return register.metrics();
  });
}