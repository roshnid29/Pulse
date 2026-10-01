export const createJobSchema = {
  body: {
    type: 'object',
    required: ['type', 'payload'],
    properties: {
      type: { type: 'string', minLength: 1 },
      payload: { type: 'object' },
    },
  },
};