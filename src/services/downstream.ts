import { createMockService } from './mock-service.js';
import { createResiliencePolicy } from '../lib/resilience.js';

function buildService(name: string) {
  const rawCall = createMockService(name);
  const { policy, breakerPolicy, metrics } = createResiliencePolicy(name);

  return {
    call: <T>(result: T) => policy.execute(() => rawCall(result)),
    breakerPolicy,
    metrics,
  };
}


export const customerService = buildService('customer');
export const paymentService = buildService('payment');
export const notificationService = buildService('notification');