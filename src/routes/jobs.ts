import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { Prisma } from '../generated/prisma/client.js';
import { createJobSchema } from '../schema/job.schema.js';
import { jobQueue } from '../lib/queue.js';

export async function jobRoutes(app: FastifyInstance) {
  // Create a job
  app.post('/jobs', { schema: createJobSchema }, async (request, reply) => {
    const { type, payload } = request.body as { type: string; payload: Prisma.InputJsonValue };

    const job = await prisma.job.create({
      data: { type, payload },
    });
    await jobQueue.add(
      'process-job',
      { jobId: job.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 1000 } }
    );

    return reply.code(201).send(job);
  });

  // Get a job by id
  app.get('/jobs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const job = await prisma.job.findUnique({
      where: { id },
      include: { attempts: true },
    });

    if (!job) {
      return reply.code(404).send({ message: 'Job not found' });
    }

    return job;
  });

  // List jobs
  app.get('/jobs', async () => {
    return prisma.job.findMany({
      orderBy: { createdAt: 'desc' },
    });
  });
}