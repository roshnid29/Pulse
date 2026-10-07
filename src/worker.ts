import 'dotenv/config';
import { Worker } from 'bullmq';
import { connection } from './lib/redis.js';
import { prisma } from './lib/prisma.js';
import { customerService, notificationService, paymentService } from './services/downstream.js';
import { logger } from './lib/logger.js';
import { jobsProcessedCounter, register } from './lib/metrics.js';
import { createServer } from 'http';

const metricsServer = createServer(async (req, res) => {
  if (req.url === '/metrics') {
    res.setHeader('Content-Type', register.contentType);
    res.end(await register.metrics());
  } else {
    res.statusCode = 404;
    res.end();
  }
});

metricsServer.listen(9091, () => {
  logger.info('Worker metrics server listening on port 9091');
});

const worker = new Worker(
    'jobs',
    async (job) => {

        const { jobId, requestId  } = job.data as { jobId: string, requestId: string  };
        const log = logger.child({ requestId, jobId });

        log.info('Starting job processing');

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

            log.info('Job completed successfully');
            jobsProcessedCounter.inc({ status: 'completed' });
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

            log.error({ err: error, attemptNumber, isLastAttempt }, 'Job attempt failed');
            jobsProcessedCounter.inc({ status: isLastAttempt ? 'failed' : 'retrying' });

            throw err; // re-throw so BullMQ still knows to retry / count this as a failure
        }
    },
    { connection }
);

worker.on('completed', (job) => {
  logger.info({ requestId: job.data.requestId, jobId: job.data.jobId, queueJobId: job.id }, 'Job completed (worker event)');
});

worker.on('failed', (job, err) => {
  logger.error({ requestId: job?.data?.requestId, jobId: job?.data?.jobId, err: err.message, queueJobId: job?.id }, 'Job failed (worker event)');
});