import { eventBus, type ReadingRecordedEvent } from '../../shared/events/event-bus';
import { notFound } from '../../shared/http/errors';
import { sensorsApi } from '../sensors';
import { troughsApi } from '../troughs';
import { alertsRepository } from './alerts.repository';
import type { ListAlertsQuery } from './alerts.schemas';

/** Minimum gap between two alerts for the same sensor. */
const COOLDOWN_MS = 10 * 60 * 1000;
const lastAlertAt = new Map<string, number>();

/** Trough status cache, kept current via `trough.status.changed`. */
const troughStatus = new Map<string, string>();
let troughStatusLoaded = false;

async function isRunning(troughId: string) {
  if (!troughStatusLoaded) {
    (await troughsApi.listBasic()).forEach((t) => troughStatus.set(t.id, t.status));
    troughStatusLoaded = true;
  }
  return troughStatus.get(troughId) === 'RUNNING';
}

const round = (v: number) => Math.round(v * 10) / 10;

export const alertsService = {
  onTroughStatusChanged({ troughId, status }: { troughId: string; status: string }) {
    troughStatus.set(troughId, status);
  },

  /**
   * Subscribed to `telemetry.reading.recorded`: raises an alert when a reading
   * breaches its thresholds. Only running troughs are evaluated — an idle
   * trough with fans off is expected, not an alarm.
   */
  async evaluateReading(event: ReadingRecordedEvent) {
    const sensor = await sensorsApi.getCached(event.sensorId);
    if (!sensor || !sensor.isActive) return;
    if (!(await isRunning(sensor.troughId))) return;

    const { minThreshold: min, maxThreshold: max } = sensor;
    const below = min != null && event.value < min;
    const above = max != null && event.value > max;
    if (!below && !above) return;

    const now = Date.now();
    if (now - (lastAlertAt.get(sensor.id) ?? 0) < COOLDOWN_MS) return;
    lastAlertAt.set(sensor.id, now);

    const limit = (below ? min : max) as number;
    const range = min != null && max != null ? max - min : Math.abs(limit) || 1;
    const deviation = Math.abs(event.value - limit);
    const severity = deviation > range * 0.1 ? 'CRITICAL' : 'WARNING';
    const message = `${sensor.label} ${below ? 'below minimum' : 'above maximum'} (${round(event.value)} ${sensor.unit}, limit ${limit} ${sensor.unit})`;

    const alert = await alertsRepository.create({
      troughId: sensor.troughId,
      sensorId: sensor.id,
      severity,
      message,
      value: event.value,
    });

    eventBus.emit('alert.raised', {
      id: alert.id,
      troughId: alert.troughId,
      sensorId: alert.sensorId,
      severity: alert.severity,
      message: alert.message,
      value: alert.value,
      createdAt: alert.createdAt.toISOString(),
    });
  },

  async list(query: ListAlertsQuery) {
    const [alerts, troughs] = await Promise.all([alertsRepository.list(query), troughsApi.listBasic()]);
    const codes = new Map(troughs.map((t) => [t.id, t.code]));
    return Promise.all(
      alerts.map(async (a) => ({
        ...a,
        troughCode: codes.get(a.troughId) ?? null,
        sensorType: a.sensorId ? (await sensorsApi.getCached(a.sensorId))?.type ?? null : null,
      })),
    );
  },

  countOpen: () => alertsRepository.countOpen(),

  async acknowledge(id: string, userId: string) {
    const alert = await alertsRepository.findById(id);
    if (!alert) throw notFound('Alert');
    if (alert.acknowledged) return alert;
    const updated = await alertsRepository.acknowledge(id, userId);
    eventBus.emit('alert.acknowledged', { id, acknowledgedById: userId });
    return updated;
  },
};
