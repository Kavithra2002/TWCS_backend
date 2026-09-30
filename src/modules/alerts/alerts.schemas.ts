import { z } from 'zod';

export const listAlertsQuerySchema = z.object({
  status: z.enum(['open', 'acknowledged', 'all']).default('all'),
  troughId: z.string().optional(),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export type ListAlertsQuery = z.infer<typeof listAlertsQuerySchema>;
