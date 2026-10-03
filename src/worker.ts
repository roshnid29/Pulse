import 'dotenv/config';
import { Worker } from 'bullmq';
import { connection } from './lib/redis.js';
import { prisma } from './lib/prisma.js';
import { customerService, notificationService, paymentService } from './services/downstream.js';

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
            data: { jobId, attemptNumber, status: 'PROCESSING' },
        });

        try {
            
            await customerService.call({ verified: true });
            await paymentService.call({ success: true, transactionId: crypto.randomUUID() });
            await notificationService.call({ sent: true });

            await prisma.job.update({
                where: { id: jobId },
                data: { status: 'COMPLETED', error: null },
            });

            await prisma.jobAttempt.update({
                where: { id: attempt.id },
                data: { status: 'COMPLETED', finishedAt: new Date() },
            });
        } catch (err) {
            const error = err instanceof Error ? err.message : 'Unknown error';
            const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);

            await prisma.job.update({
                where: { id: jobId },
                data: { status: isLastAttempt ? 'FAILED' : 'RETRYING', error },
            });

            await prisma.jobAttempt.update({
                where: { id: attempt.id },
                data: { status: 'FAILED', error, finishedAt: new Date() },
            });

            throw err; // re-throw so BullMQ still knows to retry / count this as a failure
        }
    },
    { connection }
);

worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
    console.log(`Job ${job?.id} failed: ${err.message}`);
});