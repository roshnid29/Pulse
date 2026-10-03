import type { FastifyInstance } from 'fastify';
import { connection } from '../lib/redis.js';

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
}