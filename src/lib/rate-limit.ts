import { connection } from './redis.js';

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 5;

export async function checkRateLimit(identifier: string) {
  const key = `rate:${identifier}`;

  const current = await connection.incr(key);

  if (current === 1) {
    // first request in this window — start the TTL now
    await connection.expire(key, WINDOW_SECONDS);
  }

  const allowed = current <= MAX_REQUESTS;

  return { allowed, current, limit: MAX_REQUESTS };
}