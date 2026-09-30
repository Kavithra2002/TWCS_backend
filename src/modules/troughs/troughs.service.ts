import type { Trough } from '@prisma/client';
import { eventBus } from '../../shared/events/event-bus';
import { notFound } from '../../shared/http/errors';
import { factoriesApi } from '../factories';
import { sensorsApi } from '../sensors';
import { telemetryApi } from '../telemetry';
import { troughsRepository } from './troughs.repository';
import type {
  CreateTroughInput,
  ListTroughsQuery,
  TroughStatusValue,
  UpdateTroughInput,
} from './troughs.schemas';

/** Attaches each trough's sensors with their latest reading. */
async function withLiveData(troughs: Trough[]) {
  const sensors = await sensorsApi.listByTroughIds(troughs.map((t) => t.id));
  const latest = await telemetryApi.latestMap(sensors.map((s) => s.id));
  return troughs.map((t) => ({
    ...t,
    sensors: sensors
      .filter((s) => s.troughId === t.id)
      .map((s) => ({ ...s, latest: latest.get(s.id) ?? null })),
  }));
}

export type TroughWithLiveData = Awaited<ReturnType<typeof withLiveData>>[number];

export const troughsService = {
  async list(query: ListTroughsQuery) {
    return withLiveData(await troughsRepository.list(query));
  },

  listBasic: (query: ListTroughsQuery = {}) => troughsRepository.list(query),

  async getBasic(id: string) {
    const trough = await troughsRepository.findById(id);
    if (!trough) throw notFound('Trough');
    return trough;
  },

  async getById(id: string) {
    const [trough] = await withLiveData([await this.getBasic(id)]);
    return trough;
  },

  async create(input: CreateTroughInput) {
    await factoriesApi.getById(input.factoryId);
    const trough = await troughsRepository.create(input);
    await sensorsApi.createDefaults(trough.id, trough.capacityKg);
    return this.getById(trough.id);
  },

  async update(id: string, input: UpdateTroughInput) {
    await this.getBasic(id);
    return troughsRepository.update(id, input);
  },

  async setStatus(id: string, status: TroughStatusValue) {
    const current = await this.getBasic(id);
    if (current.status === status) return current;
    const trough = await troughsRepository.update(id, { status });
    eventBus.emit('trough.status.changed', { troughId: id, status });
    return trough;
  },
};
