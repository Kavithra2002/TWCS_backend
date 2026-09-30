import { z } from 'zod';

export const troughStatusSchema = z.enum(['IDLE', 'RUNNING', 'MAINTENANCE', 'OFFLINE']);

export const listTroughsQuerySchema = z.object({
  factoryId: z.string().optional(),
  status: troughStatusSchema.optional(),
});

export const createTroughSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(2).max(120),
  factoryId: z.string().min(1),
  capacityKg: z.number().positive().max(10000),
});

export const updateTroughSchema = createTroughSchema.omit({ factoryId: true }).partial();

export const updateTroughStatusSchema = z.object({ status: troughStatusSchema });

export type TroughStatusValue = z.infer<typeof troughStatusSchema>;
export type ListTroughsQuery = z.infer<typeof listTroughsQuerySchema>;
export type CreateTroughInput = z.infer<typeof createTroughSchema>;
export type UpdateTroughInput = z.infer<typeof updateTroughSchema>;
