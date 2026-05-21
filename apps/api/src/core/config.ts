import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_PUBLIC_URL: z.string().url().default('http://localhost:4000'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 4),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),
  EMAIL_VERIFY_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24),
  PASSWORD_RESET_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60),

  STORAGE_DRIVER: z.enum(['local', 's3', 'r2']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./uploads'),
  STORAGE_PUBLIC_PREFIX: z.string().default('/uploads'),
  STORAGE_S3_BUCKET: z.string().optional(),
  STORAGE_S3_REGION: z.string().default('auto'),
  STORAGE_S3_ENDPOINT: z.string().optional(),
  STORAGE_S3_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_S3_SECRET_ACCESS_KEY: z.string().optional(),
  /** Public base URL for objects (R2 public bucket URL or cdn.braventex.in).
   *  Empty → presigned GETs used instead (good for private buckets). */
  STORAGE_PUBLIC_BASE_URL: z.string().default(''),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(200),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),

  RESEND_API_KEY: z.string().optional().default(''),
  EMAIL_FROM: z.string().default('Braventex <noreply@braventex.in>'),
  EMAIL_REPLY_TO: z.string().optional().default(''),
  APP_PUBLIC_URL: z.string().url().default('http://localhost:3000'),
});

// Railway/Render inject a $PORT — fall back to it when API_PORT is unset.
const envWithPortFallback = {
  ...process.env,
  API_PORT: process.env.API_PORT ?? process.env.PORT,
};

const parsed = schema.safeParse(envWithPortFallback);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export type AppConfig = typeof config;
