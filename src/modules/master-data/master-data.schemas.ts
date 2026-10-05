import { z } from 'zod';

const codeField = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, hyphens, or underscores')
  .transform((value) => value.toUpperCase());

const descriptionField = z
  .string()
  .trim()
  .max(240)
  .nullish()
  .transform((value) => value || null);

export const createScreenSchema = z.object({
  code: codeField,
  name: z.string().trim().min(2).max(80),
  description: descriptionField,
});

export const createViewSchema = z.object({
  code: codeField,
  name: z.string().trim().min(2).max(80),
  description: descriptionField,
});

export const assignScreensSchema = z.object({
  screenIds: z.array(z.string().min(1)).max(200),
});

export const viewParamsSchema = z.object({
  id: z.string().min(1),
  viewId: z.string().min(1),
});

export const userParamSchema = z.object({
  userId: z.string().min(1),
});

export type CreateScreenInput = z.infer<typeof createScreenSchema>;
export type CreateViewInput = z.infer<typeof createViewSchema>;
export type AssignScreensInput = z.infer<typeof assignScreensSchema>;
