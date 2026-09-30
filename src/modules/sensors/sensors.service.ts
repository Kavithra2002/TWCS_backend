import type { Sensor } from '@prisma/client';
import { notFound } from '../../shared/http/errors';
import { SENSOR_DEFAULTS } from './sensor-defaults';
import { sensorsRepository } from './sensors.repository';
import type { ListSensorsQuery, UpdateSensorInput } from './sensors.schemas';

/**
 * Sensor metadata is read on every incoming reading (telemetry + alerts),
 * so it is cached in memory and invalidated on writes.
 */
const cache = new Map<string, Sensor>();
let cacheLoaded = false;

async function loadCache() {
  if (cacheLoaded) return;
  const sensors = await sensorsRepository.listAll();
  cache.clear();
  sensors.forEach((s) => cache.set(s.id, s));
  cacheLoaded = true;
}

function invalidate() {
  cacheLoaded = false;
}

export const sensorsService = {
  async list(query: ListSensorsQuery) {
    return query.troughId ? sensorsRepository.listByTroughIds([query.troughId]) : sensorsRepository.listAll();
  },

  listAll: () => sensorsRepository.listAll(),
  listByTroughIds: (troughIds: string[]) => sensorsRepository.listByTroughIds(troughIds),

  async getById(id: string) {
    const sensor = await sensorsRepository.findById(id);
    if (!sensor) throw notFound('Sensor');
    return sensor;
  },

  /** Fast lookup for hot paths. Returns undefined for unknown ids. */
  async getCached(id: string): Promise<Sensor | undefined> {
    await loadCache();
    let sensor = cache.get(id);
    if (!sensor) {
      sensor = (await sensorsRepository.findById(id)) ?? undefined;
      if (sensor) cache.set(id, sensor);
    }
    return sensor;
  },

  async update(id: string, input: UpdateSensorInput) {
    await this.getById(id);
    const sensor = await sensorsRepository.update(id, input);
    invalidate();
    return sensor;
  },

  async createDefaults(troughId: string, capacityKg: number) {
    await sensorsRepository.createMany(
      SENSOR_DEFAULTS.map((s) => ({
        troughId,
        type: s.type,
        label: s.label,
        unit: s.unit,
        minThreshold: s.min,
        maxThreshold: s.type === 'LEAF_WEIGHT' ? capacityKg : s.max,
      })),
    );
    invalidate();
  },
};
