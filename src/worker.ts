import 'dotenv/config';
import { Worker } from 'bullmq';
import { connection } from './lib/redis.js';
import { prisma } from './lib/prisma.js';

const worker = new Worker(
  'jobs',
  async (job) => {
    const { jobId } = job.data as { jobId: string };

    const existingAttempts = await prisma.jobAttempt.count({ where: { jobId } });
    const attemptNumber = existingAttempts + 1;

    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'PROCESSING' },
    });

    const attempt = await prisma.jobAttempt.create({
      data: {
        jobId,
        attemptNumber,
        status: 'PROCESSING',
      },
    });

    // Fake "doing work" for now — real downstream calls come in Phase 3
    await new Promise((resolve) => setTimeout(resolve, 2000));

    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'COMPLETED' },
    });

    await prisma.jobAttempt.update({
      where: { id: attempt.id },
      data: { status: 'COMPLETED', finishedAt: new Date() },
    });
  },
  { connection }
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.log(`Job ${job?.id} failed: ${err.message}`);
});