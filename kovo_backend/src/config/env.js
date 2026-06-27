'use strict';

const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {
  console.warn('Failed to set custom DNS servers:', e.message);
}

const z = require('zod');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Allow placeholder credentials in mock mode
const isMockMode = process.env.USE_MOCK_DB === 'true' ||
  (process.env.SUPABASE_URL || '').includes('your-project.supabase.co');

const optionalInMock = (schema) => isMockMode ? z.string().optional().default('mock') : schema;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(0).max(65535).default(5000),
  API_PREFIX: z.string().default('/api/v1'),

  SUPABASE_URL: z.string().url().optional().default('https://mock.supabase.co'),
  SUPABASE_ANON_KEY: optionalInMock(z.string().min(1)),
  SUPABASE_SERVICE_ROLE_KEY: optionalInMock(z.string().min(1)),
  SUPABASE_JWT_SECRET: z.string().min(1).default('kovo-local-dev-jwt-secret-change-in-production'),

  CLOUDINARY_CLOUD_NAME: optionalInMock(z.string().min(1)),
  CLOUDINARY_API_KEY: optionalInMock(z.string().min(1)),
  CLOUDINARY_API_SECRET: optionalInMock(z.string().min(1)),
  CLOUDINARY_UPLOAD_PRESET: z.string().min(1).default('kovo-uploads'),

  OPENAI_API_KEY: z.string().optional(),
  MODERATION_FAIL_OPEN: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),

  REPORT_HIDE_THRESHOLD: z.coerce.number().int().min(1).default(3),
  PROFILE_PENALTY_RATE: z.coerce.number().min(0).max(1).default(0.2),
  BASE_HELPFUL_POINTS: z.coerce.number().int().min(1).default(10),
  DEFAULT_PAGE_SIZE: z.coerce.number().int().min(1).max(100).default(20),
  MAX_PAGE_SIZE: z.coerce.number().int().min(1).max(200).default(50),
  CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(60),
  ADMIN_EMAILS: z.string().default(''),

  ALLOWED_MIME_TYPES: z.string().default(
    'image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,application/pdf,text/plain,text/csv,application/zip,application/x-zip-compressed'
  ),
  MAX_FILE_SIZE_BYTES: z.coerce.number().int().min(1).default(10485760),

  CORS_ORIGIN: z.string().default('*'),
  USE_MOCK_DB: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

// Derived values — computed once, immutable after
env.ADMIN_EMAIL_LIST = env.ADMIN_EMAILS
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
env.ALLOWED_MIME_SET = new Set(
  env.ALLOWED_MIME_TYPES.split(',').map((m) => m.trim().toLowerCase())
);

module.exports = Object.freeze(env);
