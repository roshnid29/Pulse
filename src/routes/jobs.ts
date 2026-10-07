import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { Prisma } from '../generated/prisma/client.js';
import { createJobSchema } from '../schema/job.schema.js';
import { jobQueue } from '../lib/queue.js';
import { checkRateLimit } from '../lib/rate-limit.js';
import { claimIdempotencyKey, getIdempotencyResult, saveIdempotencyResult } from '../lib/idempotency.js';
import { authenticate } from '../lib/auth.js';

export async function jobRoutes(app: FastifyInstance) {
  // Create a job
  app.post(
    '/jobs',
    {
      schema: createJobSchema,
      preHandler: [
        authenticate,
        async (request, reply) => {
          const { allowed, current, limit } = await checkRateLimit(request.ip);

          if (!allowed) {
            return reply.code(429).send({
              message: 'Too many requests. Please try again later.',
              limit,
              current,
            });
          }
        },
      ],
    }, async (request, reply) => {
      const { type, payload } = request.body as { type: string; payload: Prisma.InputJsonValue };
      const idempotencyKey = request.headers['idempotency-key'] as string | undefined;

      if (idempotencyKey) {
        const claimed = await claimIdempotencyKey(idempotencyKey);

        if (!claimed) {
          const existingJobId = await getIdempotencyResult(idempotencyKey);

          if (existingJobId === null) {
            return reply.code(409).send({ message: 'This request is already being processed.' });
          }

          const existingJob = await prisma.job.findUnique({ where: { id: existingJobId } });
          return reply.code(200).send(existingJob);
        }
      }

      const job = await prisma.job.create({
        data: { type, payload, userId: (request as any).user.userId, requestId: request.id  },
      });
      await jobQueue.add(
        'process-job',
        { jobId: job.id, requestId: job.requestId  },
        { attempts: 3, backoff: { type: 'exponential', delay: 1000 } }
      );

      if (idempotencyKey) {
        await saveIdempotencyResult(idempotencyKey, job.id);
      }

      return reply.code(201).send(job);
    });

  // Get a job by id
  app.get('/jobs/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUser = (request as any).user as { userId: string; role: string };

    const job = await prisma.job.findUnique({
      where: { id },
      include: { attempts: true },
    });

    if (!job) {
      return reply.code(404).send({ message: 'Job not found' });
    }

    const isOwner = job.userId === currentUser.userId;
    const isAdmin = currentUser.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return reply.code(403).send({ message: 'You do not have access to this job' });
    }

    return job;
  });

  // List jobs
  app.get('/jobs', { preHandler: authenticate }, async (request) => {
    const currentUser = (request as any).user as { userId: string; role: string };

    const where = currentUser.role === 'ADMIN' ? {} : { userId: currentUser.userId };

    return prisma.job.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  });
}