import { z } from 'zod';

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm (24h)');

export const scheduleActionSchema = z.enum([
  'WITHERING_CYCLE',
  'FAN_ON',
  'HEATER_ON',
  'REVERSE_AIRFLOW',
  'LEAF_TURNING',
  'MAINTENANCE',
]);

const scheduleFields = z.object({
  troughId: z.string().min(1),
  name: z.string().min(2).max(80),
  action: scheduleActionSchema,
  startTime: timeSchema,
  endTime: timeSchema,
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  setpoint: z.number().finite().nullable().optional(),
  enabled: z.boolean().default(true),
});

// "HH:mm" strings compare correctly as text.
const endAfterStart = (v: { startTime?: string; endTime?: string }) =>
  !v.startTime || !v.endTime || v.endTime > v.startTime;
const endAfterStartMessage = { message: 'endTime must be after startTime', path: ['endTime'] };

export const createScheduleSchema = scheduleFields.refine(endAfterStart, endAfterStartMessage);

export const updateScheduleSchema = scheduleFields
  .omit({ troughId: true })
  .partial()
  .refine(endAfterStart, endAfterStartMessage);

export const listSchedulesQuerySchema = z.object({
  troughId: z.string().optional(),
});

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
export type ListSchedulesQuery = z.infer<typeof listSchedulesQuerySchema>;
