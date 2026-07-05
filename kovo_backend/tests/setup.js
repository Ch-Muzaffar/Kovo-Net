'use strict';

const path = require('path');
// Load root .env file containing real database credentials
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

process.env.NODE_ENV = 'test';
process.env.USE_MOCK_DB = 'false';
process.env.PORT = process.env.PORT || '0';
process.env.API_PREFIX = process.env.API_PREFIX || '/api/v1';

// Ensure real Supabase configuration from .env is kept
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://fwoytcdekizljikykbqb.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
process.env.SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'kovo-local-dev-jwt-secret-change-in-production';

process.env.CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'test';
process.env.CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '0000000000';
process.env.CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || 'test-secret';
process.env.CLOUDINARY_UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || 'test-preset';
process.env.MODERATION_FAIL_OPEN = process.env.MODERATION_FAIL_OPEN || 'true';
process.env.REPORT_HIDE_THRESHOLD = process.env.REPORT_HIDE_THRESHOLD || '3';
process.env.PROFILE_PENALTY_RATE = process.env.PROFILE_PENALTY_RATE || '0.2';
process.env.BASE_HELPFUL_POINTS = process.env.BASE_HELPFUL_POINTS || '10';
process.env.DEFAULT_PAGE_SIZE = process.env.DEFAULT_PAGE_SIZE || '10';
process.env.MAX_PAGE_SIZE = process.env.MAX_PAGE_SIZE || '50';
process.env.CACHE_TTL_SECONDS = process.env.CACHE_TTL_SECONDS || '60';
process.env.ADMIN_EMAILS = process.env.ADMIN_EMAILS || 'admin@kovo.net';
process.env.ALLOWED_MIME_TYPES = process.env.ALLOWED_MIME_TYPES || 'image/jpeg,image/png,application/pdf';
process.env.MAX_FILE_SIZE_BYTES = process.env.MAX_FILE_SIZE_BYTES || '10485760';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

