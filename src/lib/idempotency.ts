import { connection } from './redis.js';

const TTL_SECONDS = 60 * 60 * 24; // remember a key for 24 hours

export async function claimIdempotencyKey(key: string) {
  const result = await connection.set(`idempotency:${key}`, 'pending', 'EX', TTL_SECONDS, 'NX');
  return result === 'OK'; // true = you got the locker key, false = already taken
}

export async function saveIdempotencyResult(key: string, jobId: string) {
  await connection.set(`idempotency:${key}`, jobId, 'EX', TTL_SECONDS);
}

export async function getIdempotencyResult(key: string) {
  const value = await connection.get(`idempotency:${key}`);
  return value === 'pending' ? null : value;
}