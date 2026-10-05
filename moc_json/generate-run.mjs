/**
 * Builds moc01.json–moc14.json: one withering session, one snapshot per file,
 * spread evenly from 0 h to 14 h.
 *
 * Weight: surface moisture leaves quickly in the first 30% of the run, then
 * moisture inside the leaf falls more slowly through the remaining time.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));

const COUNT = 14;
const DURATION_H = 14;
const DURATION_MIN = DURATION_H * 60;
const SURFACE_FRACTION = 0.3;
const START_WEIGHT = 1200;
const END_WEIGHT = 988;
const TARGET_WEIGHT = 990;
const START = new Date('2026-09-22T06:30:00Z');

const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const lerp = (a, b, t) => a + (b - a) * t;

/** Fraction of total water loss removed by time fraction t in [0, 1]. */
function lossFraction(t) {
  const surfaceShare = 0.62;
  if (t <= SURFACE_FRACTION) {
    const u = t / SURFACE_FRACTION;
    const k = 2.6;
    const f = (1 - Math.exp(-k * u)) / (1 - Math.exp(-k));
    return surfaceShare * f;
  }
  const u = (t - SURFACE_FRACTION) / (1 - SURFACE_FRACTION);
  const k = 0.9;
  const f = (1 - Math.exp(-k * u)) / (1 - Math.exp(-k));
  return surfaceShare + (1 - surfaceShare) * f;
}

function weightAt(t) {
  return START_WEIGHT - (START_WEIGHT - END_WEIGHT) * lossFraction(t);
}

/** High flow while surface water is leaving, then settle at 45 Hz. */
function vfdHz(t) {
  if (t <= 0.3) return lerp(50, 46.5, t / 0.3);
  if (t <= 0.7) return lerp(46.5, 45, (t - 0.3) / 0.4);
  return 45;
}

/** Hot air stays low during the surface phase, then opens toward 65%. */
function hotLouver(t) {
  if (t <= 0.28) return lerp(28, 38, t / 0.28);
  if (t <= 0.62) return lerp(38, 65, (t - 0.28) / 0.34);
  return 65;
}

/** Cold/ambient louver starts open and closes toward 20% as hot air takes over. */
function coldLouver(t) {
  if (t <= 0.28) return lerp(72, 58, t / 0.28);
  if (t <= 0.62) return lerp(58, 20, (t - 0.28) / 0.34);
  return 20;
}

function upperTemp(t) {
  if (t <= SURFACE_FRACTION) return lerp(28.4, 32.2, t / SURFACE_FRACTION);
  return lerp(32.2, 39.6, (t - SURFACE_FRACTION) / (1 - SURFACE_FRACTION));
}

function upperRh(t) {
  if (t <= SURFACE_FRACTION) return lerp(84, 72, t / SURFACE_FRACTION);
  return lerp(72, 61, (t - SURFACE_FRACTION) / (1 - SURFACE_FRACTION));
}

let energyKwh = 0;
let prevHour = 0;
let prevPower = 11 * (vfdHz(0) / 50) ** 3;

const summary = [];

for (let i = 0; i < COUNT; i += 1) {
  const t = i / (COUNT - 1);
  const hour = round2(t * DURATION_H);
  const elapsedMin = Math.round(hour * 60);
  const generated = new Date(START.getTime() + elapsedMin * 60_000);
  const weight = round1(weightAt(t));
  const hz = round1(vfdHz(t));
  const hot = Math.round(hotLouver(t));
  const cold = Math.round(coldLouver(t));
  const aaw = t < SURFACE_FRACTION + 0.02;
  const haw = t >= SURFACE_FRACTION - 0.02;
  const finished = i === COUNT - 1;
  const power = round2(11 * (hz / 50) ** 3);
  if (i > 0) energyKwh += ((prevPower + power) / 2) * (hour - prevHour);
  prevHour = hour;
  prevPower = power;
  const directEnergy = round2(energyKwh);
  const integratedEnergy = round2(energyKwh * 1.025);
  const speedEnergy = round2(energyKwh * 0.985);
  const progress = round1(clamp(((START_WEIGHT - weight) / (START_WEIGHT - TARGET_WEIGHT)) * 100, 0, 100));
  const remaining = Math.max(0, DURATION_MIN - elapsedMin);
  const actionRequired = t >= 0.28 && t <= 0.36;

  const bits =
    (finished ? 0 : 1) +
    (aaw ? 2 : 0) +
    (haw ? 4 : 0) +
    (hz > 0 ? 16 : 0) +
    32 +
    (actionRequired ? 64 : 0);

  const event = eventFor(i, t, progress, remaining);

  const doc = {
    schema: 'twcs.vbox.three_packets.sample.v1',
    generated_at: generated.toISOString().replace('.000Z', 'Z'),
    disclaimer:
      'Simulated 14-hour wither for Dashboard 2. Packet shape follows moc sample v1 and can change when the PLC baseline is frozen.',
    packets: [
      {
        packet_version: 1,
        packet_type: 1,
        packet_type_name: 'Metadata',
        mw_range: '%MW678-%MW699',
        company_code: 1001,
        factory_code: 20,
        trough_no: 3,
        start_year: 2026,
        start_month: 9,
        start_day: 22,
        start_hour: 6,
        start_minute: 30,
        start_second: 0,
        session_sequence: 12345,
        period_of_wither_min: DURATION_MIN,
        target_weight_kg: TARGET_WEIGHT,
        smr_start_weight_kg: START_WEIGHT,
        end_weight_kg: finished ? weight : null,
        final_quality_code: finished ? 1 : null,
        end_elapsed_min: finished ? elapsedMin : null,
        speed_estimated_energy_kwh: speedEnergy,
        direct_vfd_energy_kwh: directEnergy,
        power_integrated_energy_kwh: integratedEnergy,
        session_active: !finished,
        missing_metadata: {
          tea_master_user_id: null,
          starting_moisture_pct: null,
          standard_of_plucking: null,
          thickness_of_spread_mm: null,
        },
      },
      {
        packet_version: 1,
        packet_type: 3,
        packet_type_name: 'TimeSeries',
        mw_range: '%MW1760-%MW1795',
        sample_sequence: 1001 + i,
        session_sequence: 12345,
        process_stage_code: haw && !aaw ? 30 : 20,
        status_flags: bits,
        status_flags_decoded: {
          bit0_session_active: !finished,
          bit1_aaw_active: aaw,
          bit2_haw_active: haw,
          bit3_fault_present: false,
          bit4_vfd_running: true,
          bit5_time_to_target_valid: true,
          bit6_operator_tea_master_action_required: actionRequired,
          bit7_15_reserved: 0,
        },
        upper_temp_c: round1(upperTemp(t)),
        lower_temp_c: round1(upperTemp(t) - 1.8),
        inlet_temp_c: round1(lerp(24.6, 35.4, haw ? (t - 0.2) / 0.8 : 0)),
        ambient_temp_c: round1(22.1 + Math.sin(t * Math.PI) * 1.1),
        upper_rh_pct: round1(upperRh(t)),
        lower_rh_pct: round1(upperRh(t) + 1.6),
        inlet_rh_pct: round1(lerp(62, 48, t)),
        ambient_rh_pct: round1(60.3 + Math.sin(t * 2) * 1.4),
        chamber_pressure_pa: 101300 + (i % 4) * 8,
        current_weight_kg: weight,
        withering_std_progress_pct: progress,
        target_weight_kg: TARGET_WEIGHT,
        elapsed_wither_min: elapsedMin,
        time_to_target_min: remaining,
        time_to_target_valid: true,
        vfd_frequency_hz: hz,
        pressure_setpoint_pa: 101000,
        hot_louver_position_pct: hot,
        cold_louver_position_pct: cold,
        vfd_power_kw: power,
        direct_vfd_session_energy_kwh: directEnergy,
        power_integrated_energy_kwh: integratedEnergy,
        speed_estimated_energy_kwh: speedEnergy,
        first_fault_code: 0,
        aaw_active: aaw,
        haw_active: haw,
        fault_present: false,
        vfd_running: true,
        plc_heartbeat: 98000 + i * 137,
        ts_commit_sequence: 1001 + i,
        comms_status: 0,
      },
      {
        packet_version: 1,
        packet_type: 2,
        packet_type_name: 'Event',
        mw_range: '%MW1975-%MW1999',
        event_sequence: 501 + i,
        session_sequence: 12345,
        event_code: event.code,
        event_name: event.name,
        process_stage_code: haw && !aaw ? 30 : 20,
        airflow_mode_code: haw && !aaw ? 2 : 1,
        airflow_mode_name: haw && !aaw ? 'HAW' : 'AAW',
        event_source_code: 1,
        event_source_name: 'PLC',
        user_actor_code: null,
        fault_code: 0,
        exit_reason: event.exit,
        event_value_1: progress,
        event_value_2: remaining,
        action_required: actionRequired,
        event_flags: 0,
        reserved: null,
      },
    ],
  };

  const name = `moc${String(i + 1).padStart(2, '0')}.json`;
  writeFileSync(join(dir, name), `${JSON.stringify(doc, null, 2)}\n`);
  summary.push({ name, hour, weight, hz, hot, cold, aaw, haw });
}

console.table(summary);

function eventFor(i, t, progress, remaining) {
  if (i === 0) return { code: 100, name: 'Session Started', exit: 'Green leaf loaded' };
  if (t >= SURFACE_FRACTION - 0.02 && t <= SURFACE_FRACTION + 0.08) {
    return { code: 210, name: 'Surface Moisture Phase Complete', exit: 'Switch toward hot air for internal moisture' };
  }
  if (i === COUNT - 1) return { code: 900, name: 'Session Completed', exit: 'Target wither reached' };
  if (t > 0.55 && t < 0.7) return { code: 400, name: 'LTO Recommendation / Action Required', exit: 'Target trend requires LTO' };
  return { code: 300, name: 'Progress Sample', exit: `Elapsed progress ${progress}%` };
}
