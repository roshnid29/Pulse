export const chaosSchema = {
  params: {
    type: 'object',
    required: ['service'],
    properties: {
      service: { type: 'string', enum: ['customer', 'payment', 'notification'] },
    },
  },
  body: {
    type: 'object',
    properties: {
      failureRate: { type: 'number', minimum: 0, maximum: 1 },
      latencyMs: { type: 'number', minimum: 0 },
    },
  },
};