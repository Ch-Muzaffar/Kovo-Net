'use strict';

const env = require('./env');

// ─── Mock mode detection ───
// Use mock when USE_MOCK_DB=true OR when Supabase URL is a placeholder
const IS_MOCK = process.env.USE_MOCK_DB === 'true' ||
  env.SUPABASE_URL.includes('your-project.supabase.co');

let supabaseAdmin, createUserClient, supabaseAnon;

function wrapClient(client) {
  if (!client) return client;
  const originalFrom = client.from;
  client.from = function(tableName) {
    const builder = originalFrom.call(client, tableName);
    if (tableName === 'notifications') {
      const originalInsert = builder.insert;
      builder.insert = function(values, _options) {
        const queryInstance = originalInsert.apply(this, arguments);
        const originalThen = queryInstance.then;
        queryInstance.then = function(onfulfilled, onrejected) {
          return originalThen.call(queryInstance, (res) => {
            try {
              const { sendToUser } = require('../utils/websocket');
              const items = Array.isArray(values) ? values : [values];
              for (const item of items) {
                if (item.user_id) {
                  sendToUser(item.user_id, {
                    type: 'new_notification',
                    userId: item.user_id
                  });
                }
              }
            } catch (err) {
              console.error('WebSocket notification trigger error:', err);
            }
            if (onfulfilled) return onfulfilled(res);
            return res;
          }, onrejected);
        };
        return queryInstance;
      };
    }
    return builder;
  };
  return client;
}

if (IS_MOCK) {
  const { mockSupabaseAdmin, createMockUserClient } = require('../db/mockDb');
  supabaseAdmin = wrapClient(mockSupabaseAdmin);
  supabaseAnon = wrapClient(mockSupabaseAdmin);
  createUserClient = createMockUserClient;
  console.log('[Kovo] Running with in-memory mock database (no Supabase required)');
} else {
  const { createClient } = require('@supabase/supabase-js');
  const ws = require('ws');

  // Admin client: bypasses RLS — used ONLY for system-level and admin operations.
  const adminClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
    realtime: { transport: ws }
  });
  supabaseAdmin = wrapClient(adminClient);

  // Anon client: used for user authentication and public/anon operations.
  const anonClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
    realtime: { transport: ws }
  });
  supabaseAnon = wrapClient(anonClient);

  /**
   * Creates a user-scoped Supabase client.
   * RLS policies enforce row-level access based on the JWT identity.
   * @param {string} accessToken - The user's JWT from Supabase Auth
   */
  createUserClient = function(accessToken) {
    return wrapClient(createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'public' },
      realtime: { transport: ws }
    }));
  };
}

module.exports = { supabaseAdmin, createUserClient, supabaseAnon };
