import type { SensorType } from '@prisma/client';

/** Sensors fitted to every new withering trough, with default alert thresholds. */
export const SENSOR_DEFAULTS: { type: SensorType; label: string; unit: string; min: number; max: number }[] = [
  { type: 'AIR_TEMPERATURE', label: 'Air temperature', unit: '°C', min: 20, max: 36 },
  { type: 'LEAF_TEMPERATURE', label: 'Leaf temperature', unit: '°C', min: 20, max: 33 },
  { type: 'HUMIDITY', label: 'Relative humidity', unit: '%RH', min: 55, max: 90 },
  { type: 'LEAF_MOISTURE', label: 'Leaf moisture', unit: '%', min: 52, max: 82 },
  { type: 'AIRFLOW', label: 'Airflow', unit: 'm³/h', min: 12000, max: 30000 },
  { type: 'FAN_SPEED', label: 'Fan speed', unit: 'rpm', min: 600, max: 1500 },
  { type: 'LEAF_WEIGHT', label: 'Leaf weight', unit: 'kg', min: 0, max: 1800 },
];
