import { Queue } from 'bullmq';
import { connection } from './redis.js';

export const jobQueue = new Queue('jobs', { connection });