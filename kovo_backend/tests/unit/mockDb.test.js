'use strict';

const { mockSupabaseAdmin, tables } = require('../../src/db/mockDb');

describe('Mock Database Extension and Query Builder', () => {
  beforeEach(() => {
    // Clear custom tables between tests
    tables.direct_messages = [];
    tables.ledger_transactions = [];
    tables.reports = [];
    tables.user_profiles = [];
    tables.user_points = [];
    tables.posts = [];
    tables.post_tags = [];
  });

  test('should insert and select from direct_messages, ledger_transactions, and reports tables', async () => {
    // Insert direct message
    const msgResult = await mockSupabaseAdmin
      .from('direct_messages')
      .insert({ sender_id: 'user-1', receiver_id: 'user-2', body: 'Hello' })
      .select()
      .single();

    expect(msgResult.error).toBeNull();
    expect(msgResult.data).toBeDefined();
    expect(msgResult.data.body).toBe('Hello');
    expect(tables.direct_messages).toHaveLength(1);

    // Insert ledger transaction
    const txResult = await mockSupabaseAdmin
      .from('ledger_transactions')
      .insert({ target_user_id: 'user-1', source_user_id: 'user-2', base_points: 10, points_awarded: 8 })
      .select()
      .single();

    expect(txResult.error).toBeNull();
    expect(txResult.data.points_awarded).toBe(8);
    expect(tables.ledger_transactions).toHaveLength(1);

    // Insert report
    const reportResult = await mockSupabaseAdmin
      .from('reports')
      .insert({ reporter_id: 'user-1', target_type: 'post', target_id: 'post-123', reason: 'spam' })
      .select()
      .single();

    expect(reportResult.error).toBeNull();
    expect(reportResult.data.reason).toBe('spam');
    expect(tables.reports).toHaveLength(1);
  });

  test('should support gt and lt operators', async () => {
    // Seed some posts with different created_at dates
    tables.posts = [
      { id: 'post-1', user_id: 'u1', created_at: '2026-06-25T10:00:00.000Z', is_hidden: false },
      { id: 'post-2', user_id: 'u1', created_at: '2026-06-25T11:00:00.000Z', is_hidden: false },
      { id: 'post-3', user_id: 'u1', created_at: '2026-06-25T12:00:00.000Z', is_hidden: false },
    ];

    // Filter using lt
    const ltResult = await mockSupabaseAdmin
      .from('posts')
      .select()
      .lt('created_at', '2026-06-25T12:00:00.000Z');

    expect(ltResult.data).toHaveLength(2);
    expect(ltResult.data.map(p => p.id)).toContain('post-1');
    expect(ltResult.data.map(p => p.id)).toContain('post-2');

    // Filter using gt
    const gtResult = await mockSupabaseAdmin
      .from('posts')
      .select()
      .gt('created_at', '2026-06-25T10:00:00.000Z');

    expect(gtResult.data).toHaveLength(2);
    expect(gtResult.data.map(p => p.id)).toContain('post-2');
    expect(gtResult.data.map(p => p.id)).toContain('post-3');
  });

  test('should support the or operator with conditions', async () => {
    tables.direct_messages = [
      { id: 'm1', sender_id: 'user-1', receiver_id: 'user-2', body: 'Msg 1', is_hidden: false },
      { id: 'm2', sender_id: 'user-2', receiver_id: 'user-1', body: 'Msg 2', is_hidden: false },
      { id: 'm3', sender_id: 'user-1', receiver_id: 'user-3', body: 'Msg 3', is_hidden: false },
    ];

    // Filter messages between user-1 and user-2
    const result = await mockSupabaseAdmin
      .from('direct_messages')
      .select()
      .or('and(sender_id.eq.user-1,receiver_id.eq.user-2),and(sender_id.eq.user-2,receiver_id.eq.user-1)');

    expect(result.data).toHaveLength(2);
    expect(result.data.map(m => m.id)).toContain('m1');
    expect(result.data.map(m => m.id)).toContain('m2');

    // Filter messages sent by or received by user-3
    const resultOr = await mockSupabaseAdmin
      .from('direct_messages')
      .select()
      .or('sender_id.eq.user-3,receiver_id.eq.user-3');

    expect(resultOr.data).toHaveLength(1);
    expect(resultOr.data[0].id).toBe('m3');
  });

  test('should resolve subquery filters for IN queries', async () => {
    // Seed tags and posts
    tables.posts = [
      { id: 'p1', title: 'Post 1', is_hidden: false },
      { id: 'p2', title: 'Post 2', is_hidden: false },
      { id: 'p3', title: 'Post 3', is_hidden: false },
    ];
    tables.post_tags = [
      { id: 't1', post_id: 'p1', tag_value: 'javascript' },
      { id: 't2', post_id: 'p2', tag_value: 'python' },
    ];

    // Subquery: get post IDs tagged with 'javascript'
    const subquery = mockSupabaseAdmin
      .from('post_tags')
      .select('post_id')
      .in('tag_value', ['javascript']);

    // Main query
    const result = await mockSupabaseAdmin
      .from('posts')
      .select()
      .in('id', subquery);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('p1');
  });

  test('should support the increment_points RPC', async () => {
    tables.user_points = [
      { id: 'up1', user_id: 'user-1', total_points: 80, level: 1 }
    ];
    tables.user_profiles = [
      { id: 'user-1', first_name: 'John', last_name: 'Doe', points: 80 }
    ];

    const result = await mockSupabaseAdmin.rpc('increment_points', {
      p_user_id: 'user-1',
      p_points: 30
    });

    expect(result.error).toBeNull();
    
    // Total points should be 80 + 30 = 110. Level should be (110 / 100) + 1 = 2
    expect(tables.user_points[0].total_points).toBe(110);
    expect(tables.user_points[0].level).toBe(2);
    expect(tables.user_profiles[0].points).toBe(110);
  });
});
