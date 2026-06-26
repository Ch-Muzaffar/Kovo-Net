'use strict';

const env = require('./env');

// ─── Mock mode detection ───
// Use mock when USE_MOCK_DB=true OR when Supabase URL is a placeholder
const IS_MOCK = process.env.USE_MOCK_DB === 'true' ||
  env.SUPABASE_URL.includes('your-project.supabase.co');

let supabaseAdmin, createUserClient;

if (IS_MOCK) {
  const { mockSupabaseAdmin, createMockUserClient } = require('../db/mockDb');
  supabaseAdmin = mockSupabaseAdmin;
  createUserClient = createMockUserClient;
  console.log('[Kovo] Running with in-memory mock database (no Supabase required)');
} else {
  const { createClient } = require('@supabase/supabase-js');
  // Admin client: bypasses RLS — used ONLY for system-level and admin operations.
  supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
  });

  /**
   * Creates a user-scoped Supabase client.
   * RLS policies enforce row-level access based on the JWT identity.
   * @param {string} accessToken - The user's JWT from Supabase Auth
   */
  createUserClient = function(accessToken) {
    return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'public' },
    });
  };
}

module.exports = { supabaseAdmin, createUserClient };
