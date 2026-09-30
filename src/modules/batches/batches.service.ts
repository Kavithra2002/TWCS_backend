import type { Batch } from '@prisma/client';
import { eventBus } from '../../shared/events/event-bus';
import { badRequest, conflict, notFound } from '../../shared/http/errors';
import { sensorsApi } from '../sensors';
import { telemetryApi } from '../telemetry';
import { troughsApi } from '../troughs';
import { batchesRepository } from './batches.repository';
import type { AbortBatchInput, CompleteBatchInput, CreateBatchInput, ListBatchesQuery } from './batches.schemas';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function generateCode(troughCode: string) {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `B${ymd}-${troughCode}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

/** Adds trough code, live leaf moisture and withering progress. */
async function enrich(batches: Batch[]) {
  const troughs = await troughsApi.listBasic();
  const troughCodes = new Map(troughs.map((t) => [t.id, t.code]));

  const witheringTroughIds = [...new Set(batches.filter((b) => b.status === 'WITHERING').map((b) => b.troughId))];
  const moistureSensors = witheringTroughIds.length
    ? (await sensorsApi.listByTroughIds(witheringTroughIds)).filter((s) => s.type === 'LEAF_MOISTURE')
    : [];
  const latest = await telemetryApi.latestMap(moistureSensors.map((s) => s.id));
  const moistureByTrough = new Map(moistureSensors.map((s) => [s.troughId, latest.get(s.id)?.value ?? null]));

  return batches.map((b) => {
    const currentMoisture = b.status === 'WITHERING' ? moistureByTrough.get(b.troughId) ?? null : b.finalMoisture;
    const progressPct =
      currentMoisture == null
        ? null
        : clamp(((b.initialMoisture - currentMoisture) / (b.initialMoisture - b.targetMoisture)) * 100, 0, 100);
    const elapsedMinutes = b.startedAt
      ? Math.round(((b.endedAt ?? new Date()).getTime() - b.startedAt.getTime()) / 60000)
      : null;

    return { ...b, troughCode: troughCodes.get(b.troughId) ?? null, currentMoisture, progressPct, elapsedMinutes };
  });
}

function emitChanged(batch: Batch) {
  eventBus.emit('batch.changed', { batchId: batch.id, troughId: batch.troughId, status: batch.status });
}

export const batchesService = {
  async list(query: ListBatchesQuery) {
    return enrich(await batchesRepository.list(query));
  },

  async listActive() {
    return enrich(await batchesRepository.listActive());
  },

  async getBasic(id: string) {
    const batch = await batchesRepository.findById(id);
    if (!batch) throw notFound('Batch');
    return batch;
  },

  async getById(id: string) {
    const [batch] = await enrich([await this.getBasic(id)]);
    return batch;
  },

  async create({ startNow, ...input }: CreateBatchInput) {
    const trough = await troughsApi.getBasic(input.troughId);
    const batch = await batchesRepository.create({ ...input, code: generateCode(trough.code) });
    emitChanged(batch);
    return startNow ? this.start(batch.id) : this.getById(batch.id);
  },

  async start(id: string) {
    const batch = await this.getBasic(id);
    if (batch.status !== 'PLANNED') throw badRequest(`Cannot start a ${batch.status.toLowerCase()} batch`);

    const trough = await troughsApi.getBasic(batch.troughId);
    if (trough.status === 'MAINTENANCE' || trough.status === 'OFFLINE') {
      throw badRequest(`Trough ${trough.code} is ${trough.status.toLowerCase()}`);
    }
    if (await batchesRepository.findActiveByTrough(batch.troughId)) {
      throw conflict(`Trough ${trough.code} already has a withering batch`);
    }

    const updated = await batchesRepository.update(id, { status: 'WITHERING', startedAt: new Date() });
    await troughsApi.setStatus(batch.troughId, 'RUNNING');
    emitChanged(updated);
    return this.getById(id);
  },

  async complete(id: string, input: CompleteBatchInput) {
    const batch = await this.getBasic(id);
    if (batch.status !== 'WITHERING') throw badRequest('Only withering batches can be completed');

    let finalMoisture = input.finalMoisture;
    if (finalMoisture == null) {
      const [enriched] = await enrich([batch]);
      finalMoisture = enriched.currentMoisture ?? undefined;
    }

    const updated = await batchesRepository.update(id, {
      status: 'COMPLETED',
      endedAt: new Date(),
      finalMoisture,
      notes: input.notes ?? batch.notes,
    });
    await troughsApi.setStatus(batch.troughId, 'IDLE');
    emitChanged(updated);
    return this.getById(id);
  },

  async abort(id: string, input: AbortBatchInput) {
    const batch = await this.getBasic(id);
    if (batch.status !== 'PLANNED' && batch.status !== 'WITHERING') {
      throw badRequest(`Cannot abort a ${batch.status.toLowerCase()} batch`);
    }
    const updated = await batchesRepository.update(id, {
      status: 'ABORTED',
      endedAt: new Date(),
      notes: input.reason ? `${batch.notes ? `${batch.notes}\n` : ''}Aborted: ${input.reason}` : batch.notes,
    });
    if (batch.status === 'WITHERING') await troughsApi.setStatus(batch.troughId, 'IDLE');
    emitChanged(updated);
    return this.getById(id);
  },
};
