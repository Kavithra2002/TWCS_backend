import { z } from 'zod';

export const ingestReadingsSchema = z.object({
  readings: z
    .array(
      z.object({
        sensorId: z.string().min(1),
        value: z.number().finite(),
        recordedAt: z.coerce.date().optional(),
      }),
    )
    .min(1)
    .max(1000),
});

export const latestQuerySchema = z.object({
  troughId: z.string().optional(),
});

export const seriesQuerySchema = z.object({
  sensorId: z.string().min(1),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  points: z.coerce.number().int().min(10).max(1000).default(200),
});

export type IngestReading = z.infer<typeof ingestReadingsSchema>['readings'][number];
export type LatestQuery = z.infer<typeof latestQuerySchema>;
export type SeriesQuery = z.infer<typeof seriesQuerySchema>;
