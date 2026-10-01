import { connection } from '../lib/redis.js';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createMockService(serviceName: string) {
  const failureRateKey = `chaos:${serviceName}:failureRate`;
  const latencyKey = `chaos:${serviceName}:latencyMs`;

  return async function callService<T>(result: T): Promise<T> {
    const failureRate = Number((await connection.get(failureRateKey)) ?? 0);
    const latencyMs = Number((await connection.get(latencyKey)) ?? 200);

    await sleep(latencyMs);

    if (Math.random() < failureRate) {
      throw new Error(`${serviceName} service failed (simulated)`);
    }

    return result;
  };
}