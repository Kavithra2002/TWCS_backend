import { z } from 'zod';

export const startPublisherSchema = z
  .object({
    troughId: z
      .string()
      .regex(/^t0[1-6]$/, 'troughId must be t01–t06')
      .default('t01'),
  })
  .default({ troughId: 't01' });

export type StartPublisherBody = z.infer<typeof startPublisherSchema>;
