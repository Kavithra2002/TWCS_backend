import { z } from 'zod';

export const listSensorsQuerySchema = z.object({
  troughId: z.string().optional(),
});

export const updateSensorSchema = z
  .object({
    label: z.string().min(1).max(80).optional(),
    minThreshold: z.number().finite().nullable().optional(),
    maxThreshold: z.number().finite().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => v.minThreshold == null || v.maxThreshold == null || v.minThreshold < v.maxThreshold, {
    message: 'minThreshold must be lower than maxThreshold',
  });

export type ListSensorsQuery = z.infer<typeof listSensorsQuerySchema>;
export type UpdateSensorInput = z.infer<typeof updateSensorSchema>;
