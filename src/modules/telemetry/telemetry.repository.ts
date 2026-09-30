import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';

export interface LatestRow {
  sensorId: string;
  value: number;
  recordedAt: Date;
}

export interface BucketRow {
  bucket: Date;
  avg: number;
  min: number;
  max: number;
  count: bigint;
}

export const telemetryRepository = {
  async createMany(rows: { sensorId: string; value: number; recordedAt: Date }[]) {
    // Chunk to stay well below PostgreSQL's bind-parameter limit.
    const size = 5000;
    for (let i = 0; i < rows.length; i += size) {
      await prisma.reading.createMany({ data: rows.slice(i, i + size) });
    }
  },

  latestForSensors(sensorIds: string[]) {
    if (sensorIds.length === 0) return Promise.resolve([] as LatestRow[]);
    return prisma.$queryRaw<LatestRow[]>`
      SELECT DISTINCT ON ("sensorId") "sensorId", "value", "recordedAt"
      FROM "Reading"
      WHERE "sensorId" IN (${Prisma.join(sensorIds)})
      ORDER BY "sensorId", "recordedAt" DESC`;
  },

  /**
   * Time-bucketed aggregates for charting.
   * "recordedAt" is `timestamp` (UTC, no zone), so the bound parameters are
   * converted to UTC explicitly; otherwise PostgreSQL would apply the session
   * time zone when comparing timestamp with timestamptz.
   */
  bucketed(sensorId: string, from: Date, to: Date, bucketSeconds: number) {
    return prisma.$queryRaw<BucketRow[]>`
      SELECT
        to_timestamp(floor(extract(epoch FROM "recordedAt") / ${bucketSeconds}::int) * ${bucketSeconds}::int) AS bucket,
        avg("value")::float8 AS avg,
        min("value")::float8 AS min,
        max("value")::float8 AS max,
        count(*) AS count
      FROM "Reading"
      WHERE "sensorId" = ${sensorId}
        AND "recordedAt" BETWEEN (${from}::timestamptz AT TIME ZONE 'UTC') AND (${to}::timestamptz AT TIME ZONE 'UTC')
      GROUP BY bucket
      ORDER BY bucket`;
  },

  countSince: (since: Date) => prisma.reading.count({ where: { recordedAt: { gte: since } } }),
};
