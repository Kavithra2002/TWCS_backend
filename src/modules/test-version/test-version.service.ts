import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import mqtt, { type IClientOptions, type MqttClient } from 'mqtt';
import { Pool, type QueryResultRow } from 'pg';
import { env } from '../../config/env';
import { AppError } from '../../shared/http/errors';
import { logger } from '../../shared/logger';

export type PublishKind = 'session' | 'events' | 'timeseries';

export interface PublishLogEntry {
  at: string;
  kind: PublishKind;
  topic: string;
  sampleId?: string;
  index?: number;
  total?: number;
  ok: boolean;
  error?: string;
  payload?: unknown;
}

export interface DbLiveSnapshot {
  polledAt: string | null;
  ok: boolean;
  error: string | null;
  session: QueryResultRow | null;
  events: QueryResultRow[];
  timeSeries: QueryResultRow[];
  counts: { sessions: number; events: number; time_series: number };
}

export interface PublisherStatus {
  running: boolean;
  connected: boolean;
  brokerUrl: string;
  clientId: string;
  topics: { session: string; events: string; timeseries: string };
  intervalMs: number;
  troughId: string | null;
  witheringId: string | null;
  sampleIndex: number;
  sampleTotal: number;
  startedAt: string | null;
  lastError: string | null;
  lastSent: { at: string; kind: PublishKind; topic: string; payload: unknown } | null;
  recentSent: PublishLogEntry[];
  db: DbLiveSnapshot;
  log: PublishLogEntry[];
  tunnelHint: string;
}

interface SessionRow {
  withering_id: string;
  [key: string]: unknown;
}

interface EventRow {
  event_id: string;
  withering_id: string;
  [key: string]: unknown;
}

interface TimeSeriesRow {
  sample_id: string;
  withering_id: string;
  timestamp: string;
  [key: string]: unknown;
}

const MAX_LOG = 100;
const TROUGH_IDS = ['t01', 't02', 't03', 't04', 't05', 't06'] as const;

function mocDir(troughId: string) {
  return path.resolve(process.cwd(), 'moc_json', troughId);
}

function readJson<T>(filePath: string): T {
  if (!existsSync(filePath)) {
    throw new AppError(404, `Missing mock file: ${filePath}`);
  }
  const raw = readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw) as T;
}

function loadTrough(troughId: string) {
  const dir = mocDir(troughId);
  const session = readJson<SessionRow>(path.join(dir, 'session.json'));
  const events = readJson<EventRow[]>(path.join(dir, 'event.json'));
  const timeSeries = readJson<TimeSeriesRow[]>(path.join(dir, 'time_series.json'));
  if (!Array.isArray(events) || !Array.isArray(timeSeries) || timeSeries.length === 0) {
    throw new AppError(400, `Invalid mock data for ${troughId}`);
  }
  return { session, events, timeSeries };
}

function emptyDb(): DbLiveSnapshot {
  return {
    polledAt: null,
    ok: false,
    error: null,
    session: null,
    events: [],
    timeSeries: [],
    counts: { sessions: 0, events: 0, time_series: 0 },
  };
}

function createInitialStatus(): PublisherStatus {
  return {
    running: false,
    connected: false,
    brokerUrl: env.MQTT_BROKER_URL,
    clientId: env.MQTT_CLIENT_ID,
    topics: {
      session: env.MQTT_TOPIC_SESSION,
      events: env.MQTT_TOPIC_EVENTS,
      timeseries: env.MQTT_TOPIC_TIMESERIES,
    },
    intervalMs: env.MQTT_PUBLISH_INTERVAL_MS,
    troughId: null,
    witheringId: null,
    sampleIndex: 0,
    sampleTotal: 0,
    startedAt: null,
    lastError: null,
    lastSent: null,
    recentSent: [],
    db: emptyDb(),
    log: [],
    tunnelHint: 'ssh -L 15432:127.0.0.1:5432 root@168.144.35.189',
  };
}

let status = createInitialStatus();
let client: MqttClient | null = null;
let publishTimer: ReturnType<typeof setInterval> | null = null;
let dbTimer: ReturnType<typeof setInterval> | null = null;
let session: SessionRow | null = null;
let events: EventRow[] = [];
let timeSeries: TimeSeriesRow[] = [];
let pool: Pool | null = null;

function pushLog(entry: Omit<PublishLogEntry, 'at'> & { at?: string }) {
  const row: PublishLogEntry = { at: entry.at ?? new Date().toISOString(), ...entry };
  status.log = [row, ...status.log].slice(0, MAX_LOG);
  if (entry.ok && entry.payload !== undefined) {
    status.lastSent = {
      at: row.at,
      kind: row.kind,
      topic: row.topic,
      payload: entry.payload,
    };
    if (row.kind === 'timeseries') {
      status.recentSent = [row, ...status.recentSent].slice(0, 40);
    }
  }
}

function topicFor(kind: PublishKind) {
  if (kind === 'session') return env.MQTT_TOPIC_SESSION;
  if (kind === 'events') return env.MQTT_TOPIC_EVENTS;
  return env.MQTT_TOPIC_TIMESERIES;
}

function publishJson(kind: PublishKind, payload: unknown, meta?: Partial<PublishLogEntry>): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = topicFor(kind);
    if (!client || !client.connected) {
      const err = new Error('MQTT client is not connected');
      pushLog({ kind, topic: t, ok: false, error: err.message, payload, ...meta });
      reject(err);
      return;
    }
    client.publish(t, JSON.stringify(payload), { qos: 1, retain: false }, (err) => {
      if (err) {
        pushLog({ kind, topic: t, ok: false, error: err.message, payload, ...meta });
        reject(err);
        return;
      }
      pushLog({ kind, topic: t, ok: true, payload, ...meta });
      resolve();
    });
  });
}

function nextTimeseriesPayload(source: TimeSeriesRow) {
  return {
    ...source,
    sample_id: randomUUID(),
    timestamp: new Date().toISOString().slice(0, 19),
  };
}

async function publishBootstrap() {
  if (!session || !timeSeries.length) return;
  await publishJson('session', session);
  await publishJson('events', events, { index: events.length, total: events.length });
  const first = nextTimeseriesPayload(timeSeries[0]);
  status.sampleIndex = 1;
  await publishJson('timeseries', first, {
    sampleId: String(first.sample_id),
    index: 1,
    total: timeSeries.length,
  });
}

async function publishNextSample() {
  if (!status.running || !timeSeries.length) return;
  if (!client?.connected) {
    status.lastError = 'MQTT disconnected — waiting to reconnect…';
    return;
  }

  const idx = status.sampleIndex % timeSeries.length;
  const point = nextTimeseriesPayload(timeSeries[idx]);
  const displayIndex = status.sampleIndex + 1;
  try {
    await publishJson('timeseries', point, {
      sampleId: String(point.sample_id),
      index: displayIndex,
      total: timeSeries.length,
    });
    status.sampleIndex = displayIndex;
    status.lastError = null;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Publish failed';
    status.lastError = message;
    logger.error({ err }, 'Test Version MQTT: sample publish failed');
  }
}

function stopPublishTimer() {
  if (publishTimer) {
    clearInterval(publishTimer);
    publishTimer = null;
  }
}

function stopDbTimer() {
  if (dbTimer) {
    clearInterval(dbTimer);
    dbTimer = null;
  }
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: env.VBOX_DATABASE_URL,
      connectionTimeoutMillis: 4000,
      idleTimeoutMillis: 10_000,
      max: 2,
    });
  }
  return pool;
}

async function pollDb() {
  const witheringId = status.witheringId;
  if (!witheringId) return;

  try {
    const db = getPool();
    const [sessionRes, eventsRes, tsRes, countsRes] = await Promise.all([
      db.query(`SELECT * FROM sessions WHERE withering_id = $1`, [witheringId]),
      db.query(`SELECT * FROM events WHERE withering_id = $1 ORDER BY timestamp ASC`, [witheringId]),
      db.query(
        `SELECT sample_id, withering_id, timestamp, ambient_rh_pct, ambient_temp_c, inlet_rh_pct, inlet_temp_c,
                upper_rh_pct, upper_temp_c, lower_rh_pct, lower_temp_c, chamber_pressure_pa, pressure_demand_pa,
                fan_speed_hz, hot_louver_position_pct, hot_louver_demand_pct, amb_louver_position_pct,
                amb_louver_demand_pct, cumulative_energy_kwh, current_ws_pct, weight_kg, inserted_at
         FROM time_series
         WHERE withering_id = $1
         ORDER BY timestamp DESC
         LIMIT 100`,
        [witheringId],
      ),
      db.query(
        `SELECT
           (SELECT COUNT(*)::int FROM sessions WHERE withering_id = $1) AS sessions,
           (SELECT COUNT(*)::int FROM events WHERE withering_id = $1) AS events,
           (SELECT COUNT(*)::int FROM time_series WHERE withering_id = $1) AS time_series`,
        [witheringId],
      ),
    ]);

    status.db = {
      polledAt: new Date().toISOString(),
      ok: true,
      error: null,
      session: sessionRes.rows[0] ?? null,
      events: eventsRes.rows,
      timeSeries: tsRes.rows,
      counts: {
        sessions: countsRes.rows[0]?.sessions ?? 0,
        events: countsRes.rows[0]?.events ?? 0,
        time_series: countsRes.rows[0]?.time_series ?? 0,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'DB poll failed';
    status.db = {
      ...status.db,
      polledAt: new Date().toISOString(),
      ok: false,
      error: `${message} — open SSH tunnel: ${status.tunnelHint}`,
    };
  }
}

function startDbPolling() {
  stopDbTimer();
  void pollDb();
  dbTimer = setInterval(() => {
    void pollDb();
  }, env.MQTT_PUBLISH_INTERVAL_MS);
}

function disconnectClient() {
  stopPublishTimer();
  if (client) {
    client.removeAllListeners();
    client.end(true);
    client = null;
  }
  status.connected = false;
  status.running = false;
}

export const testVersionService = {
  listTroughs() {
    return TROUGH_IDS.map((id) => {
      const dir = mocDir(id);
      const ok = existsSync(path.join(dir, 'session.json')) && existsSync(path.join(dir, 'time_series.json'));
      return { id, available: ok };
    });
  },

  getStatus(): PublisherStatus {
    return {
      ...status,
      brokerUrl: env.MQTT_BROKER_URL,
      clientId: env.MQTT_CLIENT_ID,
      topics: {
        session: env.MQTT_TOPIC_SESSION,
        events: env.MQTT_TOPIC_EVENTS,
        timeseries: env.MQTT_TOPIC_TIMESERIES,
      },
      intervalMs: env.MQTT_PUBLISH_INTERVAL_MS,
      connected: Boolean(client?.connected),
    };
  },

  async start(troughId: string) {
    if (status.running) {
      throw new AppError(409, 'Publisher is already running. Stop it first.');
    }

    const data = loadTrough(troughId);
    session = data.session;
    events = data.events;
    timeSeries = data.timeSeries;

    disconnectClient();
    status = {
      ...createInitialStatus(),
      running: true,
      troughId,
      witheringId: session.withering_id,
      sampleIndex: 0,
      sampleTotal: timeSeries.length,
      startedAt: new Date().toISOString(),
      lastError: null,
      log: [],
      recentSent: [],
      lastSent: null,
      db: emptyDb(),
    };

    await new Promise<void>((resolve, reject) => {
      const opts: IClientOptions = {
        reconnectPeriod: 2000,
        connectTimeout: 10_000,
        clientId: `${env.MQTT_CLIENT_ID}-${Date.now()}`,
        clean: true,
      };

      client = mqtt.connect(env.MQTT_BROKER_URL, opts);

      let settled = false;

      const onError = (err: Error) => {
        status.lastError = err.message;
        if (!settled) {
          settled = true;
          status.running = false;
          status.connected = false;
          disconnectClient();
          reject(new AppError(502, `MQTT connect failed: ${err.message}`));
        }
      };

      const onConnect = () => {
        status.connected = true;
        status.lastError = null;
        if (!settled) {
          settled = true;
          resolve();
          return;
        }
        // Reconnected mid-run — resume interval (bootstrap already done).
        logger.info('Test Version MQTT: reconnected');
      };

      client.on('connect', onConnect);
      client.on('error', onError);
      client.on('close', () => {
        status.connected = false;
      });
      client.on('offline', () => {
        status.connected = false;
      });
    });

    try {
      await publishBootstrap();
      publishTimer = setInterval(() => {
        void publishNextSample();
      }, env.MQTT_PUBLISH_INTERVAL_MS);
      startDbPolling();
      logger.info(
        {
          troughId,
          broker: env.MQTT_BROKER_URL,
          samples: timeSeries.length,
          intervalMs: env.MQTT_PUBLISH_INTERVAL_MS,
        },
        'Test Version MQTT: started',
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Bootstrap publish failed';
      status.lastError = message;
      disconnectClient();
      stopDbTimer();
      throw new AppError(502, message);
    }

    return this.getStatus();
  },

  stop() {
    disconnectClient();
    stopDbTimer();
    status.running = false;
    logger.info('Test Version MQTT: stopped');
    return this.getStatus();
  },

  /**
   * Full reset to zero:
   * - stop MQTT
   * - clear published count / logs / last payload
   * - TRUNCATE droplet sessions, events, time_series
   */
  async reset() {
    disconnectClient();
    stopDbTimer();
    session = null;
    events = [];
    timeSeries = [];

    status = {
      ...createInitialStatus(),
      troughId: null,
      witheringId: null,
      sampleIndex: 0,
      sampleTotal: 0,
      startedAt: null,
      lastError: null,
      lastSent: null,
      recentSent: [],
      log: [],
      running: false,
      connected: false,
      db: {
        polledAt: new Date().toISOString(),
        ok: false,
        error: null,
        session: null,
        events: [],
        timeSeries: [],
        counts: { sessions: 0, events: 0, time_series: 0 },
      },
    };

    try {
      const db = getPool();
      await db.query('TRUNCATE TABLE time_series, events, sessions RESTART IDENTITY CASCADE');
      status.db = {
        polledAt: new Date().toISOString(),
        ok: true,
        error: null,
        session: null,
        events: [],
        timeSeries: [],
        counts: { sessions: 0, events: 0, time_series: 0 },
      };
      logger.info('Test Version: reset complete — UI zeroed and droplet DB truncated');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'TRUNCATE failed';
      status.lastError = message;
      status.db = {
        polledAt: new Date().toISOString(),
        ok: false,
        error: `${message} — open SSH tunnel: ${status.tunnelHint}`,
        session: null,
        events: [],
        timeSeries: [],
        counts: { sessions: 0, events: 0, time_series: 0 },
      };
      logger.error({ err }, 'Test Version: reset truncate failed (UI still zeroed)');
      throw new AppError(502, status.db.error ?? message);
    }

    return this.getStatus();
  },

  async refreshDb() {
    await pollDb();
    return this.getStatus();
  },

  onShutdown() {
    disconnectClient();
    stopDbTimer();
    void pool?.end();
    pool = null;
  },
};
