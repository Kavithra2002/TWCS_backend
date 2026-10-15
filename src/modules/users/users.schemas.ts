import { z } from 'zod';

/** Roles that can be chosen when creating an account from the Users panel. */
export const ASSIGNABLE_ROLES = ['executive', 'operation', 'engineering'] as const;
const UPDATABLE_ROLES = [...ASSIGNABLE_ROLES, 'super_admin'] as const;

/** Executive stays role=executive; designation picks Normal vs General Manager. */
export const executiveDesignationSchema = z.enum(['standard', 'general_manager']);

export const executiveConfigSchema = z.object({
  designation: executiveDesignationSchema.default('standard'),
  /** Trough IDs this General Manager may view. Ignored for standard executives. */
  troughIds: z.array(z.string().min(1)).default([]),
  canViewLiveMonitoring: z.boolean().default(true),
  canExportReports: z.boolean().default(false),
  receiveAlertDigest: z.boolean().default(true),
  notes: z.string().max(500).optional().nullable(),
});

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
  executiveConfig: executiveConfigSchema.optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ExecutiveConfig = z.infer<typeof executiveConfigSchema>;

export const DEFAULT_EXECUTIVE_CONFIG: ExecutiveConfig = {
  designation: 'standard',
  troughIds: [],
  canViewLiveMonitoring: true,
  canExportReports: false,
  receiveAlertDigest: true,
  notes: null,
};
