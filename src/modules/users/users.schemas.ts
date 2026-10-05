import { z } from 'zod';

/** Roles that can be chosen when creating an account from the Users panel. */
export const ASSIGNABLE_ROLES = ['executive', 'operation', 'engineering'] as const;
const UPDATABLE_ROLES = [...ASSIGNABLE_ROLES, 'super_admin'] as const;

export const createUserSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
  name: z.string().min(2).max(100),
  password: z.string().min(8).max(128),
  role: z.enum(ASSIGNABLE_ROLES),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  role: z.enum(UPDATABLE_ROLES).optional(),
  isActive: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
