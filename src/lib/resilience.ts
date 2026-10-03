import { circuitBreaker, timeout, wrap, ConsecutiveBreaker, TimeoutStrategy, handleAll, CircuitState } from 'cockatiel';
import { connection } from './redis.js';

export function createResiliencePolicy(serviceName: string) {
  const timeoutPolicy = timeout(2000, TimeoutStrategy.Aggressive);

  const breakerPolicy = circuitBreaker(handleAll, {
    halfOpenAfter: 10000,
    breaker: new ConsecutiveBreaker(3),
  });

  const metrics = { totalCalls: 0, totalFailures: 0 };

  async function syncToRedis() {
    await connection.set(
      `metrics:${serviceName}`,
      JSON.stringify({
        state: CircuitState[breakerPolicy.state],
        totalCalls: metrics.totalCalls,
        totalFailures: metrics.totalFailures,
      })
    );
  }

  breakerPolicy.onBreak(() => {
    console.log(`[${serviceName}] circuit breaker OPENED`);
    syncToRedis();
  });
  breakerPolicy.onReset(() => {
    console.log(`[${serviceName}] circuit breaker CLOSED (recovered)`);
    syncToRedis();
  });
  breakerPolicy.onHalfOpen(() => {
    console.log(`[${serviceName}] circuit breaker HALF-OPEN (testing)`);
    syncToRedis();
  });

  const policy = wrap(timeoutPolicy, breakerPolicy);

  policy.onSuccess(() => {
    metrics.totalCalls += 1;
    syncToRedis();
  });

  policy.onFailure(() => {
    metrics.totalCalls += 1;
    metrics.totalFailures += 1;
    syncToRedis();
  });

  return { policy, breakerPolicy, metrics };
}