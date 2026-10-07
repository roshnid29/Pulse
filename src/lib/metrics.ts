import client from 'prom-client';

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const jobsProcessedCounter = new client.Counter({
  name: 'jobs_processed_total',
  help: 'Total jobs processed by the worker',
  labelNames: ['status'],
  registers: [register],
});

export const queueDepthGauge = new client.Gauge({
  name: 'queue_jobs_count',
  help: 'Current number of jobs in the queue by state',
  labelNames: ['state'],
  registers: [register],
});