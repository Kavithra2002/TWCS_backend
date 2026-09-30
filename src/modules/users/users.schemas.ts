import { z } from 'zod';

export const roleSchema = z.enum(['ADMIN', 'SUPERVISOR', 'OPERATOR', 'VIEWER']);

export const createUserSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
  name: z.string().min(2).max(100),
  password: z.string().min(8).max(128),
  role: roleSchema.default('OPERATOR'),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  role: roleSchema.optional(),
  isActive: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
