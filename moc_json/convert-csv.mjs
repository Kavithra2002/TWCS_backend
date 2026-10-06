/**
 * One-off conversion of doc/Withering*.csv into moc_json JSON.
 * Run: node convert-csv.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const doc = join(here, '..', '..', 'doc');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function num(value) {
  if (value == null || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function text(value) {
  const s = value == null ? '' : String(value).trim();
  return s === '' ? null : s;
}

function objects(file, map) {
  const rows = parseCsv(readFileSync(join(doc, file), 'utf8'));
  const header = rows[0];
  return rows.slice(1).map((cols) => {
    const rec = {};
    header.forEach((name, i) => {
      rec[name] = cols[i] ?? '';
    });
    return map(rec);
  });
}

const sessions = objects('WitheringSession.csv', (r) => ({
  withering_id: text(r.WitheringID),
  company_name: text(r.CompanyName),
  factory_name: text(r.FactoryName),
  trough_number: num(r.TroughNumber),
  session_start: text(r.SessionStartDateTime),
  loading_done: text(r.LoadingDoneDateTime),
  process_start: text(r.ProcessStartDateTime),
  smr_start: text(r.SMRStartDateTime),
  imr1_start: text(r.IMR1StartDateTime),
  lto_start: text(r.LTOStartDateTime),
  lto_done: text(r.LTODoneDateTime),
  imr2_end: text(r.IMR2EndDateTime),
  session_end: text(r.SessionEndDateTime),
  user_id_start_process: text(r.UserIDStartProcess),
  user_id_lto: text(r.UserIDLTO),
  user_id_feedback: text(r.UserIDFeedback),
  auto_mode: text(r.AutoMode),
  surface_moisture_content_pct: num(r['SurfaceMoistureContent%']),
  standard_of_plucking_pct: num(r['StandardOfPlucking%']),
  thickness_of_spread_inches: num(r.ThicknessOfSpreadInches),
  period_of_wither_min: num(r.PeriodOfWitherMinutes),
  target_ws_pct: num(r['TargetWS%']),
  completion_target_dominance: num(r['CompletionTargetDominance(1=Wt,2=Time)']),
  starting_weight_kg: num(r.StartinWeightKg),
  target_weight_kg: num(r.TargetWeightKg),
  elapsed_minutes: num(r.ElapsedMinutes),
  airflow_mode: text(r['AirflowMode(HAW/AAW)']),
  session_record_created_at: text(r.SessionRecordCreatedAt),
  session_updated_at: text(r.SessionUpdatedAt),
  withering_quality: num(r['WitheringQuality(1..5)']),
  session_energy_kwh: num(r['Session Energy (kWh)']),
}));

const series = objects('WitheringProbeData.csv', (r) => ({
  sample_id: text(r.SampleID),
  withering_id: text(r.WitheringID),
  timestamp: text(r['Sample Timestamp']),
  ambient_rh_pct: num(r['AmbientRH%']),
  ambient_temp_c: num(r.AmbientTempC),
  inlet_rh_pct: num(r['InletRH%']),
  inlet_temp_c: num(r.InletTempC),
  upper_rh_pct: num(r['UpperRH%']),
  upper_temp_c: num(r.UpperTempC),
  lower_rh_pct: num(r['LowerRH%']),
  lower_temp_c: num(r.LowerTempC),
  chamber_pressure_pa: num(r.ChamberPressurePa),
  pressure_demand_pa: num(r.PressureDemandPa),
  fan_speed_hz: num(r.FanSpeedHz),
  hot_louver_position_pct: num(r['HOTLouverPosition%']),
  hot_louver_demand_pct: num(r['HOTLouverDemand%']),
  amb_louver_position_pct: num(r['AMBLouverPosition%']),
  amb_louver_demand_pct: num(r['AMBLouverDemand%']),
  cumulative_energy_kwh: num(r.CumulativeEnergyKWH),
  current_ws_pct: num(r['CurrentWS%']),
}));

const events = objects('WitheringEvent.csv', (r) => ({
  event_id: text(r.EventID),
  withering_id: text(r.WitheringID),
  event_type: text(r.EventType),
  timestamp: text(r.Timestamp),
  user_id: text(r.UserID),
  notes: text(r.Notes),
}));

writeFileSync(join(here, 'sessio.json'), `${JSON.stringify(sessions[0], null, 2)}\n`);
writeFileSync(join(here, 'time_series.json'), `${JSON.stringify(series, null, 2)}\n`);
writeFileSync(join(here, 'event.json'), `${JSON.stringify(events, null, 2)}\n`);

console.log(JSON.stringify({
  session: sessions.length,
  samples: series.length,
  events: events.length,
  firstWs: series[0]?.current_ws_pct,
  lastWs: series.at(-1)?.current_ws_pct,
  startKg: sessions[0]?.starting_weight_kg,
}, null, 2));
