'use strict';

require('../setup');

jest.mock('@supabase/supabase-js', () => {
  const responses = [];
  const mockChain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockReturnThis(),
    then: jest.fn(function(resolve, reject) {
      if (responses.length > 0) {
        return Promise.resolve(responses.shift()).then(resolve, reject);
      }
      return Promise.resolve({ data: null, error: null }).then(resolve);
    }),
  };
  return {
    createClient: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue(mockChain),
      auth: { getUser: jest.fn(), refreshSession: jest.fn() },
      rpc: jest.fn(),
    }),
    __mockChain: mockChain,
    __responses: responses,
  };
});

const { getFeed } = require('../../src/modules/feed/feed.service');
const { __responses: r } = require('@supabase/supabase-js');

describe('Feed Service — 70/30 Algorithm', () => {
  const userId = '00000000-0000-0000-0000-000000000001';
  
  beforeEach(() => {
    r.length = 0; // Clear responses queue
    const cache = require('../../src/utils/cache');
    cache.clear();
  });

  test('returns pure discovery feed when user has no profile', async () => {
    const posts = Array.from({ length: 11 }, (_, i) => ({
      id: `p-${i}`,
      user_id: `u-${i}`,
      title: `Post ${i}`,
      body: `Body ${i}`,
      attachments: [],
      is_hidden: false,
      created_at: new Date(Date.now() - i * 60000).toISOString(),
    }));

    const creators = posts.slice(0, 10).map((p) => ({
      id: p.user_id,
      first_name: 'User',
      last_name: 'Name',
      avatar_url: null,
    }));

    // Queue query responses:
    // 1. Profile query -> returns null (no profile)
    r.push({ data: null, error: null });
    // 2. Posts query -> returns 11 posts
    r.push({ data: posts, count: 100, error: null });
    // 3. Comments count query -> returns empty array
    r.push({ data: [], error: null });
    // 4. Batch fetch creators query -> returns creators list
    r.push({ data: creators, error: null });

    const result = await getFeed(userId, { pageSize: 10 });
    expect(result.data).toHaveLength(10);
    expect(result.pagination.hasMore).toBe(true);
    expect(result.data[0].creator.first_name).toBe('User');
  });

  test('returns feed when user has a profile', async () => {
    const targetedPosts = [
      { id: 'target-1', user_id: 'u-target-1', title: 'Target 1', body: 'Body 1', attachments: [], is_hidden: false, created_at: new Date(Date.now() - 1000).toISOString() },
      { id: 'target-2', user_id: 'u-target-2', title: 'Target 2', body: 'Body 2', attachments: [], is_hidden: false, created_at: new Date(Date.now() - 2000).toISOString() },
    ];
    const discoveryPosts = [
      { id: 'disc-1', user_id: 'u-disc-1', title: 'Disc 1', body: 'Body 3', attachments: [], is_hidden: false, created_at: new Date(Date.now() - 3000).toISOString() },
      { id: 'disc-2', user_id: 'u-disc-2', title: 'Disc 2', body: 'Body 4', attachments: [], is_hidden: false, created_at: new Date(Date.now() - 4000).toISOString() },
    ];

    const creators = [
      { id: 'u-target-1', first_name: 'John', last_name: 'Doe', avatar_url: null },
      { id: 'u-target-2', first_name: 'Jane', last_name: 'Smith', avatar_url: null },
      { id: 'u-disc-1', first_name: 'Bob', last_name: 'Johnson', avatar_url: null },
      { id: 'u-disc-2', first_name: 'Alice', last_name: 'Brown', avatar_url: null },
    ];

    // Queue query responses:
    // 1. Profile query -> returns user profile config
    r.push({
      data: {
        departments: ['Engineering'],
        hobbies: ['Coding'],
        master_skills: ['Javascript'],
      },
      error: null,
    });
    // 2. queryTargetPosts posts query
    r.push({ data: targetedPosts, error: null });
    // 3. queryDiscoveryPosts posts query
    r.push({ data: discoveryPosts, error: null });
    // 4. Comments count batch fetch query
    r.push({ data: [], error: null });
    // 5. User points batch fetch query
    r.push({ data: [], error: null });
    // 6. Creators batch fetch query
    r.push({ data: creators, error: null });

    const result = await getFeed(userId, { pageSize: 5 });
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.pagination.hasMore).toBe(false);
  });
});
