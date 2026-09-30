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
