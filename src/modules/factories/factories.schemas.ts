import { z } from 'zod';

export const createFactorySchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(2).max(120),
  location: z.string().max(200).optional(),
});

export const updateFactorySchema = createFactorySchema.partial();

export type CreateFactoryInput = z.infer<typeof createFactorySchema>;
export type UpdateFactoryInput = z.infer<typeof updateFactorySchema>;
