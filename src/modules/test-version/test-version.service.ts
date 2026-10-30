import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
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

/** One row from droplet `raw_vbox_data` (VNet → subscriber, about every 10s). */
export interface RawVboxRow {
  id: number;
  receivedAt: string;
  payload: Record<string, unknown>;
}

export interface FeedStatusEvent {
  at: string;
  state: 'connected' | 'disconnected';
  reason: string;
}

/** Live VNet feed, independent of the local mock publisher. */
export interface RawLiveFeed {
  polledAt: string | null;
  /** Trough 6 Run is held down: the SSH tunnel is the live session. */
  watching: boolean;
  /** SSH tunnel / Postgres query succeeded. */
  dbConnected: boolean;
  /** Newest raw row is inside the fresh window (~2× the 10s cadence). */
  feedConnected: boolean;
  error: string | null;
  lastReceivedAt: string | null;
  ageMs: number | null;
  count: number;
  rows: RawVboxRow[];
  statusLog: FeedStatusEvent[];
}

export type IntakeCell = string | number | boolean | null;
export type IntakeTableName = 'sessions' | 'events' | 'time_series';

/** Latest rows from one droplet table, column order matching `\d`. */
export interface IntakeTableSnapshot {
  columns: string[];
  rows: Record<string, IntakeCell>[];
  count: number;
  latestAt: string | null;
}

/** Live copies of sessions, events, and time_series. */
export interface IntakeSnapshot {
  polledAt: string;
  ok: boolean;
  dbConnected: boolean;
  updating: boolean;
  error: string | null;
  ageMs: number | null;
  tunnelHint: string;
  tables: Record<IntakeTableName, IntakeTableSnapshot>;
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
  /** VNet samples stored by the droplet subscriber in raw_vbox_data. */
  live: RawLiveFeed;
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
/** How often to read raw_vbox_data so a 10s insert shows up within a couple of seconds. */
const RAW_POLL_MS = 2_000;
/** Feed is "disconnected" when no new raw row has arrived inside this window. */
const FEED_FRESH_MS = 25_000;
const RAW_ROW_LIMIT = 40;
const MAX_STATUS_LOG = 40;

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

function emptyLive(): RawLiveFeed {
  return {
    polledAt: null,
    watching: false,
    dbConnected: false,
    feedConnected: false,
    error: null,
    lastReceivedAt: null,
    ageMs: null,
    count: 0,
    rows: [],
    statusLog: [],
  };
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
    live: emptyLive(),
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
let live: RawLiveFeed = emptyLive();
let rawTimer: ReturnType<typeof setInterval> | null = null;
let rawPollInFlight = false;
/** True only between Trough 6 Run and Stop. */
let watching = false;
let tunnelChild: ChildProcess | null = null;

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
      max: 3,
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

const INTAKE_TABLES = ['sessions', 'events', 'time_series'] as const;
const INTAKE_LIMITS: Record<IntakeTableName, number> = {
  sessions: 20,
  events: 40,
  time_series: 40,
};
/** A table is "updating" when its newest inserted_at is inside this window. */
const INTAKE_FRESH_MS = 25_000;

function emptyIntakeTable(): IntakeTableSnapshot {
  return { columns: [], rows: [], count: 0, latestAt: null };
}

function emptyIntake(error: string | null = null): IntakeSnapshot {
  return {
    polledAt: new Date().toISOString(),
    ok: false,
    dbConnected: false,
    updating: false,
    error,
    ageMs: null,
    tunnelHint: status.tunnelHint,
    tables: {
      sessions: emptyIntakeTable(),
      events: emptyIntakeTable(),
      time_series: emptyIntakeTable(),
    },
  };
}

function asCell(value: unknown): IntakeCell {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value);
}

function parseJsonRow(value: unknown): Record<string, IntakeCell> {
  let raw = value;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      return {};
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, IntakeCell> = {};
  for (const [key, cell] of Object.entries(raw as Record<string, unknown>)) {
    out[key] = asCell(cell);
  }
  return out;
}

/** Droplet timestamps are `timestamp without time zone` stored in UTC. */
function parseDbTime(value: IntakeCell): number | null {
  if (typeof value !== 'string' || !value) return null;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const hasZone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(normalized);
  const ms = Date.parse(hasZone ? normalized : `${normalized}Z`);
  return Number.isNaN(ms) ? null : ms;
}

async function readIntake(): Promise<IntakeSnapshot> {
  const db = getPool();
  const [sessionsRes, eventsRes, seriesRes, countsRes, columnsRes] = await Promise.all([
    db.query<{ row: unknown }>(
      `SELECT row_to_json(s) AS row
       FROM (SELECT * FROM sessions ORDER BY inserted_at DESC NULLS LAST LIMIT $1) s`,
      [INTAKE_LIMITS.sessions],
    ),
    db.query<{ row: unknown }>(
      `SELECT row_to_json(e) AS row
       FROM (SELECT * FROM events ORDER BY inserted_at DESC NULLS LAST LIMIT $1) e`,
      [INTAKE_LIMITS.events],
    ),
    db.query<{ row: unknown }>(
      `SELECT row_to_json(t) AS row
       FROM (SELECT * FROM time_series ORDER BY inserted_at DESC NULLS LAST LIMIT $1) t`,
      [INTAKE_LIMITS.time_series],
    ),
    db.query<{ sessions: number; events: number; time_series: number }>(
      `SELECT
         (SELECT COUNT(*)::int FROM sessions) AS sessions,
         (SELECT COUNT(*)::int FROM events) AS events,
         (SELECT COUNT(*)::int FROM time_series) AS time_series`,
    ),
    db.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])
       ORDER BY table_name, ordinal_position`,
      [[...INTAKE_TABLES]],
    ),
  ]);

  const columns: Record<IntakeTableName, string[]> = {
    sessions: [],
    events: [],
    time_series: [],
  };
  for (const col of columnsRes.rows) {
    if (col.table_name === 'sessions' || col.table_name === 'events' || col.table_name === 'time_series') {
      columns[col.table_name].push(col.column_name);
    }
  }

  const counts = countsRes.rows[0] ?? { sessions: 0, events: 0, time_series: 0 };
  const sources: Record<IntakeTableName, { row: unknown }[]> = {
    sessions: sessionsRes.rows,
    events: eventsRes.rows,
    time_series: seriesRes.rows,
  };

  const tables = {} as IntakeSnapshot['tables'];
  let newestMs: number | null = null;
  for (const name of INTAKE_TABLES) {
    const rows = sources[name].map((entry) => parseJsonRow(entry.row));
    const latestRaw = rows[0]?.inserted_at;
    const latestAt = typeof latestRaw === 'string' ? latestRaw : null;
    const latestMs = parseDbTime(latestAt);
    if (latestMs != null && (newestMs == null || latestMs > newestMs)) newestMs = latestMs;
    tables[name] = {
      columns: columns[name],
      rows,
      count: counts[name] ?? rows.length,
      latestAt,
    };
  }

  const ageMs = newestMs == null ? null : Date.now() - newestMs;
  const updating = ageMs != null && ageMs >= -5_000 && ageMs <= INTAKE_FRESH_MS;

  return {
    polledAt: new Date().toISOString(),
    ok: true,
    dbConnected: true,
    updating,
    error: null,
    ageMs,
    tunnelHint: status.tunnelHint,
    tables,
  };
}

let intakeInFlight: Promise<IntakeSnapshot> | null = null;

async function pollIntake(): Promise<IntakeSnapshot> {
  if (intakeInFlight) return intakeInFlight;
  intakeInFlight = (async () => {
    try {
      return await readIntake();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'DB poll failed';
      await resetVboxPool();
      return emptyIntake(`${message} — open the SSH tunnel to read withering_db.`);
    }
  })().finally(() => {
    intakeInFlight = null;
  });
  return intakeInFlight;
}

function noteFeedTransition(nextConnected: boolean, reason: string) {
  const state = nextConnected ? 'connected' : 'disconnected';
  const latest = live.statusLog[0];
  if (latest?.state === state && latest.reason === reason) return;
  live.statusLog = [
    { at: new Date().toISOString(), state, reason },
    ...live.statusLog,
  ].slice(0, MAX_STATUS_LOG);
}

async function pollRaw() {
  if (rawPollInFlight) return;
  rawPollInFlight = true;
  try {
    const db = getPool();
    const [rowsRes, countRes] = await Promise.all([
      db.query<{ id: number; received_at: string; payload: Record<string, unknown> | string }>(
        `SELECT id,
                to_char(received_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS received_at,
                payload
         FROM raw_vbox_data
         ORDER BY id DESC
         LIMIT $1`,
        [RAW_ROW_LIMIT],
      ),
      db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM raw_vbox_data`),
    ]);

    const rows: RawVboxRow[] = rowsRes.rows.map((row) => {
      let payload = row.payload;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload) as Record<string, unknown>;
        } catch {
          payload = { raw: payload };
        }
      }
      return {
        id: Number(row.id),
        receivedAt: row.received_at,
        payload: payload ?? {},
      };
    });

    const lastReceivedAt = rows[0]?.receivedAt ?? null;
    const ageMs = lastReceivedAt ? Date.now() - Date.parse(lastReceivedAt) : null;
    const fresh = ageMs != null && ageMs >= -5_000 && ageMs <= FEED_FRESH_MS;
    const feedConnected = watching && fresh;
    const reason = !watching
      ? 'Trough 6 is not running'
      : fresh
        ? 'Sample arrived from VNet'
        : 'Data is not being received';

    noteFeedTransition(feedConnected, reason);

    live = {
      ...live,
      polledAt: new Date().toISOString(),
      watching,
      dbConnected: true,
      feedConnected,
      error: fresh || !watching ? null : 'Data is not being received. The VNet box may be off.',
      lastReceivedAt,
      ageMs,
      count: countRes.rows[0]?.n ?? rows.length,
      rows,
      statusLog: live.statusLog,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'DB poll failed';
    noteFeedTransition(false, watching ? 'Database unreachable' : 'Trough 6 is not running');
    await resetVboxPool();
    if (watching) void reopenTunnel();
    live = {
      ...live,
      polledAt: new Date().toISOString(),
      watching,
      dbConnected: false,
      feedConnected: false,
      error: watching ? `${message} — open SSH tunnel: ${status.tunnelHint}` : null,
      statusLog: live.statusLog,
    };
  } finally {
    rawPollInFlight = false;
  }
}

/** Wait out a poll already in flight, then read raw_vbox_data again. */
async function pollRawNow() {
  const started = Date.now();
  while (rawPollInFlight && Date.now() - started < 8_000) {
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  await pollRaw();
}

function stopRawTimer() {
  if (rawTimer) {
    clearInterval(rawTimer);
    rawTimer = null;
  }
}

function startRawPolling() {
  if (rawTimer) return;
  void pollRaw();
  rawTimer = setInterval(() => {
    void pollRaw();
  }, RAW_POLL_MS);
}

const TUNNEL_PORT = 15432;
const TUNNEL_TARGET = 'root@168.144.35.189';
const TUNNEL_SPEC = `${TUNNEL_PORT}:127.0.0.1:5432`;
const TUNNEL_COMMAND = `ssh -f -N -L ${TUNNEL_SPEC} ${TUNNEL_TARGET}`;

function localPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    const finish = (open: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(800);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function resetVboxPool() {
  if (!pool) return;
  const current = pool;
  pool = null;
  try {
    await current.end();
  } catch {
    /* drop a pool that failed before the tunnel existed */
  }
}

/** Open the droplet forward used by raw_vbox_data. Does not start the JSON publisher. */
async function openSshTunnel() {
  if (await localPortOpen(TUNNEL_PORT)) {
    await resetVboxPool();
    void pollRaw();
    return { open: true, alreadyOpen: true, command: TUNNEL_COMMAND };
  }

  // Windows OpenSSH cannot fork, so -f is dropped and the process is detached.
  // The forward is the same one the Run button is meant to start.
  const args = [
    ...(process.platform === 'win32' ? [] : ['-f']),
    '-N',
    '-o',
    'ExitOnForwardFailure=yes',
    '-o',
    'BatchMode=yes',
    '-o',
    'ConnectTimeout=15',
    '-o',
    'ServerAliveInterval=30',
    '-L',
    TUNNEL_SPEC,
    TUNNEL_TARGET,
  ];

  let stderr = '';
  const child = spawn('ssh', args, {
    detached: true,
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  tunnelChild = child;

  child.stderr?.on('data', (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-600);
  });

  let settled = false;
  const opened = await new Promise<boolean>((resolve) => {
    const finish = (open: boolean) => {
      if (settled) return;
      settled = true;
      resolve(open);
    };

    child.once('error', (err) => {
      stderr = err.message;
      finish(false);
    });

    const started = Date.now();
    const timer = setInterval(() => {
      void localPortOpen(TUNNEL_PORT).then((open) => {
        if (open) {
          clearInterval(timer);
          finish(true);
        } else if (Date.now() - started > 12_000) {
          clearInterval(timer);
          finish(false);
        }
      });
    }, 400);

    child.once('exit', () => {
      setTimeout(() => {
        void localPortOpen(TUNNEL_PORT).then((open) => {
          if (open) {
            clearInterval(timer);
            finish(true);
            return;
          }
          if (process.platform === 'win32') {
            clearInterval(timer);
            finish(false);
          }
        });
      }, 600);
    });
  });

  child.stderr?.destroy();
  child.unref();

  if (!opened) {
    child.kill();
    if (tunnelChild === child) tunnelChild = null;
    const detail = stderr.trim() || 'port 15432 did not open';
    logger.error({ detail, command: TUNNEL_COMMAND }, 'SSH tunnel failed');
    throw new AppError(
      502,
      `SSH tunnel did not open (${detail}). This PC needs key login to ${TUNNEL_TARGET} — a password prompt cannot run from the Run button.`,
    );
  }

  await resetVboxPool();
  void pollRaw();
  logger.info({ command: TUNNEL_COMMAND }, 'SSH tunnel open for trough 6');
  return { open: true, alreadyOpen: false, command: TUNNEL_COMMAND };
}

let tunnelAttemptAt = 0;

function killPortListener(port: number): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => resolve();
    if (process.platform === 'win32') {
      execFile('netstat', ['-ano', '-p', 'tcp'], { windowsHide: true }, (err, stdout) => {
        if (err || !stdout) return finish();
        const pids = new Set<string>();
        for (const line of stdout.split(/\r?\n/)) {
          if (!line.includes(`:${port}`) || !/LISTENING/i.test(line)) continue;
          const pid = line.trim().split(/\s+/).at(-1);
          if (pid && /^\d+$/.test(pid) && pid !== '0' && pid !== String(process.pid)) pids.add(pid);
        }
        if (pids.size === 0) return finish();
        let left = pids.size;
        for (const pid of pids) {
          execFile('taskkill', ['/PID', pid, '/F', '/T'], { windowsHide: true }, () => {
            left -= 1;
            if (left === 0) finish();
          });
        }
      });
      return;
    }
    execFile('sh', ['-c', `lsof -ti tcp:${port} | xargs -r kill`], () => finish());
  });
}

/** Stop the Trough 6 session and close the SSH forward it opened. */
async function closeSshTunnel() {
  watching = false;
  const child = tunnelChild;
  tunnelChild = null;
  if (child && !child.killed) {
    try {
      child.kill();
    } catch {
      /* process already exited */
    }
  }
  await killPortListener(TUNNEL_PORT);
  await resetVboxPool();
  noteFeedTransition(false, 'Trough 6 stopped');
  live = {
    ...live,
    watching: false,
    dbConnected: false,
    feedConnected: false,
    error: null,
    polledAt: new Date().toISOString(),
    statusLog: live.statusLog,
  };
  logger.info('SSH tunnel closed — trough 6 stopped');
}

/** Bring the forward back only while Trough 6 Run is still held. */
async function reopenTunnel() {
  if (!watching) return;
  if (Date.now() - tunnelAttemptAt < 20_000) return;
  tunnelAttemptAt = Date.now();
  try {
    if (await localPortOpen(TUNNEL_PORT)) {
      await resetVboxPool();
      return;
    }
    await openSshTunnel();
  } catch (err) {
    logger.warn({ err }, 'SSH tunnel retry failed');
  }
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
      live,
    };
  },

  /** Always read raw_vbox_data, even when the mock publisher is stopped. */
  onInit() {
    startRawPolling();
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

  /** Read raw_vbox_data immediately and return the latest sample. */
  async refreshDb() {
    await pollRawNow();
    return this.getStatus();
  },

  /** Latest sessions, events, and time_series rows from the droplet. */
  intake() {
    return pollIntake();
  },

  /** Open the SSH tunnel if needed, then read the three intake tables. */
  async connectIntake() {
    await openSshTunnel();
    return pollIntake();
  },

  /** Trough 6 Run: SSH tunnel only. Does not publish the mock JSON session. */
  async openTunnel() {
    watching = true;
    try {
      const tunnel = await openSshTunnel();
      void pollRaw();
      return { ...this.getStatus(), tunnel };
    } catch (err) {
      watching = false;
      live = { ...live, watching: false, feedConnected: false };
      throw err;
    }
  },

  /** Trough 6 Stop: close the SSH tunnel and drop the live session. */
  async closeTunnel() {
    await closeSshTunnel();
    return this.getStatus();
  },

  onShutdown() {
    disconnectClient();
    stopDbTimer();
    stopRawTimer();
    void pool?.end();
    pool = null;
  },
};
