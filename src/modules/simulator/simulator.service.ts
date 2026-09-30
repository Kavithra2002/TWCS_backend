import type { Sensor, SensorType, Trough } from '@prisma/client';
import { env } from '../../config/env';
import { logger } from '../../shared/logger';
import { sensorsApi } from '../sensors';
import { telemetryApi } from '../telemetry';
import { troughsApi } from '../troughs';

/**
 * Development-only sensor simulator. Produces plausible withering-trough data:
 * leaf moisture falls from ~78% toward ~58%, and leaf weight follows it
 * (dry matter is conserved), while climate values drift around set points.
 */

interface Profile {
  base: number;
  noise: number;
  min: number;
  max: number;
}

const RUNNING_PROFILE: Record<Exclude<SensorType, 'LEAF_MOISTURE' | 'LEAF_WEIGHT'>, Profile> = {
  AIR_TEMPERATURE: { base: 29, noise: 0.4, min: 22, max: 38 },
  LEAF_TEMPERATURE: { base: 26.5, noise: 0.3, min: 21, max: 34 },
  HUMIDITY: { base: 72, noise: 1.2, min: 50, max: 95 },
  AIRFLOW: { base: 22000, noise: 350, min: 10000, max: 32000 },
  FAN_SPEED: { base: 1250, noise: 18, min: 500, max: 1550 },
};

const START_MOISTURE = 78;
const RESET_MOISTURE = 58;
const SPIKE_CHANCE = 0.004; // occasional excursions so alerts can be seen

const values = new Map<string, number>(); // sensorId -> last value
const moisture = new Map<string, number>(); // troughId -> leaf moisture %
let timer: NodeJS.Timeout | null = null;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const noise = (scale: number) => (Math.random() - 0.5) * 2 * scale;

/** Typical withering removes ~1–2 percentage points of moisture per hour. */
function nextMoisture(troughId: string, elapsedMs: number) {
  let m = moisture.get(troughId) ?? START_MOISTURE - Math.random() * 8;
  const dropPerHour = 1 + Math.random();
  m -= (dropPerHour * elapsedMs) / 3_600_000;
  if (m < RESET_MOISTURE) m = START_MOISTURE;
  moisture.set(troughId, m);
  return m;
}

function valueFor(sensor: Sensor, trough: Trough, elapsedMs: number): number | null {
  const running = trough.status === 'RUNNING';

  if (sensor.type === 'LEAF_MOISTURE') {
    if (!running) return null;
    return Number((nextMoisture(trough.id, elapsedMs) + noise(0.1)).toFixed(2));
  }
  if (sensor.type === 'LEAF_WEIGHT') {
    if (!running) return 0;
    const m = moisture.get(trough.id) ?? START_MOISTURE;
    const loadKg = trough.capacityKg * 0.85;
    const dryMatter = loadKg * (1 - START_MOISTURE / 100);
    return Math.round(dryMatter / (1 - m / 100));
  }

  const profile = RUNNING_PROFILE[sensor.type];
  if (!running) {
    if (sensor.type === 'AIRFLOW' || sensor.type === 'FAN_SPEED') return 0;
    if (sensor.type === 'HUMIDITY') return Number((80 + noise(2)).toFixed(1));
    return Number((22 + noise(0.5)).toFixed(1));
  }

  const prev = values.get(sensor.id) ?? profile.base;
  let v = prev + (profile.base - prev) * 0.08 + noise(profile.noise);
  if (Math.random() < SPIKE_CHANCE) v += (Math.random() > 0.5 ? 1 : -1) * (profile.max - profile.min) * 0.35;
  v = clamp(v, profile.min, profile.max);
  values.set(sensor.id, v);
  return Number(v.toFixed(sensor.type === 'AIRFLOW' || sensor.type === 'FAN_SPEED' ? 0 : 2));
}

async function loadTargets() {
  const [troughs, sensors] = await Promise.all([troughsApi.listBasic(), sensorsApi.listAll()]);
  const troughById = new Map(troughs.map((t) => [t.id, t]));
  return sensors
    .filter((s) => s.isActive && troughById.get(s.troughId)?.status !== 'OFFLINE')
    .map((s) => ({ sensor: s, trough: troughById.get(s.troughId)! }));
}

async function tick() {
  const targets = await loadTargets();
  // Moisture must be computed before weight within the same tick.
  targets.sort((a, b) => (a.sensor.type === 'LEAF_WEIGHT' ? 1 : 0) - (b.sensor.type === 'LEAF_WEIGHT' ? 1 : 0));
  const readings = targets
    .map(({ sensor, trough }) => ({ sensorId: sensor.id, value: valueFor(sensor, trough, env.SIMULATOR_INTERVAL_MS) }))
    .filter((r): r is { sensorId: string; value: number } => r.value !== null);
  if (readings.length) await telemetryApi.ingest(readings);
}

/** Fills the last few hours at one-minute resolution so charts have history on first run. */
async function backfill(hours: number) {
  const targets = await loadTargets();
  targets.sort((a, b) => (a.sensor.type === 'LEAF_WEIGHT' ? 1 : 0) - (b.sensor.type === 'LEAF_WEIGHT' ? 1 : 0));
  const readings: { sensorId: string; value: number; recordedAt: Date }[] = [];
  const minutes = hours * 60;
  const start = Date.now() - minutes * 60 * 1000;

  moisture.clear();
  for (let i = 0; i < minutes; i++) {
    const recordedAt = new Date(start + i * 60_000);
    for (const { sensor, trough } of targets) {
      const value = valueFor(sensor, trough, 60_000);
      if (value !== null) readings.push({ sensorId: sensor.id, value, recordedAt });
    }
  }
  await telemetryApi.ingest(readings, { emit: false });
  logger.info(`Simulator backfilled ${readings.length} readings (${hours}h)`);
}

/** Continue from stored values after a restart instead of jumping to new random ones. */
async function resumeFromLatest() {
  const sensors = await sensorsApi.listAll();
  const latest = await telemetryApi.latestMap(sensors.map((s) => s.id));
  for (const s of sensors) {
    const reading = latest.get(s.id);
    if (!reading) continue;
    values.set(s.id, reading.value);
    if (s.type === 'LEAF_MOISTURE') moisture.set(s.troughId, reading.value);
  }
}

export const simulator = {
  async start() {
    if (await telemetryApi.hasRecentData(60 * 60 * 1000)) await resumeFromLatest();
    else await backfill(6);
    timer = setInterval(() => {
      tick().catch((err) => logger.error({ err }, 'Simulator tick failed'));
    }, env.SIMULATOR_INTERVAL_MS);
    logger.warn(`Sensor simulator ON (every ${env.SIMULATOR_INTERVAL_MS} ms). Set ENABLE_SIMULATOR=false for real devices.`);
  },
  stop() {
    if (timer) clearInterval(timer);
    timer = null;
  },
};
