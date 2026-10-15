import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  DEVICE_API_KEY: z.string().min(8),
  TIMEZONE: z.string().default('Asia/Colombo'),
  ENABLE_SIMULATOR: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  SIMULATOR_INTERVAL_MS: z.coerce.number().int().min(1000).default(5000),

  /** DigitalOcean Mosquitto — local publisher connects here. */
  MQTT_BROKER_URL: z.string().default('mqtt://168.144.35.189:1883'),
  MQTT_CLIENT_ID: z.string().default('localhost-publisher-1'),
  MQTT_TOPIC_SESSION: z.string().default('withering/session'),
  MQTT_TOPIC_EVENTS: z.string().default('withering/events'),
  MQTT_TOPIC_TIMESERIES: z.string().default('withering/timeseries'),
  MQTT_PUBLISH_INTERVAL_MS: z.coerce.number().int().min(500).default(10000),

  /**
   * Droplet Postgres via SSH tunnel (recommended).
   * Tunnel: ssh -L 15432:127.0.0.1:5432 root@168.144.35.189
   * (15432 avoids clashing with local TWCS Postgres on 5432)
   */
  VBOX_DATABASE_URL: z
    .string()
    .default('postgresql://vbox_user:twcsdbpw@127.0.0.1:15432/withering_db'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGIN.split(',').map((o) => o.trim()),
  isDev: parsed.data.NODE_ENV === 'development',
};
