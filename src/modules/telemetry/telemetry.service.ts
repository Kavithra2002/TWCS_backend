import { eventBus } from '../../shared/events/event-bus';
import { badRequest } from '../../shared/http/errors';
import { sensorsApi } from '../sensors';
import { telemetryRepository } from './telemetry.repository';
import type { IngestReading, LatestQuery, SeriesQuery } from './telemetry.schemas';

const HOUR = 60 * 60 * 1000;

export interface LatestReading {
  value: number;
  recordedAt: Date;
}

export const telemetryService = {
  /**
   * Stores readings and publishes `telemetry.reading.recorded` for each one.
   * `emit: false` is used for bulk historical imports (no alerts / websocket noise).
   */
  async ingest(readings: IngestReading[], options: { emit?: boolean } = {}) {
    const { emit = true } = options;
    const now = new Date();
    const rows = [];
    const events = [];

    for (const r of readings) {
      const sensor = await sensorsApi.getCached(r.sensorId);
      if (!sensor) throw badRequest(`Unknown sensor: ${r.sensorId}`);
      const recordedAt = r.recordedAt ?? now;
      rows.push({ sensorId: r.sensorId, value: r.value, recordedAt });
      if (emit && sensor.isActive) {
        events.push({
          sensorId: sensor.id,
          troughId: sensor.troughId,
          type: sensor.type,
          unit: sensor.unit,
          value: r.value,
          recordedAt: recordedAt.toISOString(),
        });
      }
    }

    await telemetryRepository.createMany(rows);
    events.forEach((e) => eventBus.emit('telemetry.reading.recorded', e));
    return { accepted: rows.length };
  },

  async latestMap(sensorIds: string[]): Promise<Map<string, LatestReading>> {
    const rows = await telemetryRepository.latestForSensors(sensorIds);
    return new Map(rows.map((r) => [r.sensorId, { value: r.value, recordedAt: r.recordedAt }]));
  },

  async latest(query: LatestQuery) {
    const sensors = query.troughId ? await sensorsApi.listByTroughIds([query.troughId]) : await sensorsApi.listAll();
    const latest = await this.latestMap(sensors.map((s) => s.id));
    return sensors.map((s) => ({
      sensorId: s.id,
      troughId: s.troughId,
      type: s.type,
      unit: s.unit,
      latest: latest.get(s.id) ?? null,
    }));
  },

  async series({ sensorId, from, to, points }: SeriesQuery) {
    const sensor = await sensorsApi.getCached(sensorId);
    if (!sensor) throw badRequest(`Unknown sensor: ${sensorId}`);

    const end = to ?? new Date();
    const start = from ?? new Date(end.getTime() - 6 * HOUR);
    if (start >= end) throw badRequest('`from` must be before `to`');

    const bucketSeconds = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 1000 / points));
    const rows = await telemetryRepository.bucketed(sensorId, start, end, bucketSeconds);

    const data = rows.map((r) => ({ t: r.bucket.toISOString(), avg: r.avg, min: r.min, max: r.max }));
    const totalCount = rows.reduce((n, r) => n + Number(r.count), 0);
    const summary =
      rows.length === 0
        ? null
        : {
            min: Math.min(...rows.map((r) => r.min)),
            max: Math.max(...rows.map((r) => r.max)),
            avg: rows.reduce((sum, r) => sum + r.avg * Number(r.count), 0) / totalCount,
            samples: totalCount,
          };

    return {
      sensor: {
        id: sensor.id,
        troughId: sensor.troughId,
        type: sensor.type,
        label: sensor.label,
        unit: sensor.unit,
        minThreshold: sensor.minThreshold,
        maxThreshold: sensor.maxThreshold,
      },
      from: start.toISOString(),
      to: end.toISOString(),
      bucketSeconds,
      summary,
      points: data,
    };
  },

  hasRecentData: async (withinMs: number) => (await telemetryRepository.countSince(new Date(Date.now() - withinMs))) > 0,
};
