import { z } from 'zod';

export const batchStatusSchema = z.enum(['PLANNED', 'WITHERING', 'COMPLETED', 'ABORTED']);

export const listBatchesQuerySchema = z.object({
  troughId: z.string().optional(),
  status: batchStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const createBatchSchema = z
  .object({
    troughId: z.string().min(1),
    leafIntakeKg: z.number().positive().max(10000),
    initialMoisture: z.number().min(40).max(95),
    targetMoisture: z.number().min(40).max(90),
    plannedStartAt: z.coerce.date().optional(),
    notes: z.string().max(1000).optional(),
    startNow: z.boolean().default(false),
  })
  .refine((v) => v.targetMoisture < v.initialMoisture, {
    message: 'targetMoisture must be lower than initialMoisture',
    path: ['targetMoisture'],
  });

export const completeBatchSchema = z.object({
  finalMoisture: z.number().min(30).max(95).optional(),
  notes: z.string().max(1000).optional(),
});

export const abortBatchSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type ListBatchesQuery = z.infer<typeof listBatchesQuerySchema>;
export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type CompleteBatchInput = z.infer<typeof completeBatchSchema>;
export type AbortBatchInput = z.infer<typeof abortBatchSchema>;
