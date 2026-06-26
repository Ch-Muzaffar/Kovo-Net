'use strict';

const { mockSupabaseAdmin, tables } = require('./src/db/mockDb');

async function assert(condition, message) {
  if (!condition) {
    throw new Error('ASSERTION FAILED: ' + message);
  }
}

async function run() {
  console.log('Starting custom mockDb assertions...');

  // Reset tables
  tables.direct_messages = [];
  tables.ledger_transactions = [];
  tables.reports = [];
  tables.user_profiles = [];
  tables.user_points = [];
  tables.posts = [];
  tables.post_tags = [];

  // 1. Direct Messages
  const msgResult = await mockSupabaseAdmin
    .from('direct_messages')
    .insert({ sender_id: 'user-1', receiver_id: 'user-2', body: 'Hello' })
    .select()
    .single();

  await assert(msgResult.error === null, 'DM insert error should be null');
  await assert(msgResult.data.body === 'Hello', 'DM body should be Hello');
  await assert(tables.direct_messages.length === 1, 'DM table length should be 1');

  // 2. OR Operator and and(...) conditions
  tables.direct_messages = [
    { id: 'm1', sender_id: 'user-1', receiver_id: 'user-2', body: 'Msg 1', is_hidden: false },
    { id: 'm2', sender_id: 'user-2', receiver_id: 'user-1', body: 'Msg 2', is_hidden: false },
    { id: 'm3', sender_id: 'user-1', receiver_id: 'user-3', body: 'Msg 3', is_hidden: false },
  ];

  const orResult = await mockSupabaseAdmin
    .from('direct_messages')
    .select()
    .or('and(sender_id.eq.user-1,receiver_id.eq.user-2),and(sender_id.eq.user-2,receiver_id.eq.user-1)');

  await assert(orResult.data.length === 2, 'Should filter 2 messages between user-1 and user-2');

  // 3. Subquery Resolution
  tables.posts = [
    { id: 'p1', title: 'Post 1', is_hidden: false },
    { id: 'p2', title: 'Post 2', is_hidden: false },
  ];
  tables.post_tags = [
    { id: 't1', post_id: 'p1', tag_value: 'javascript' },
  ];

  const subquery = mockSupabaseAdmin
    .from('post_tags')
    .select('post_id')
    .in('tag_value', ['javascript']);

  const inResult = await mockSupabaseAdmin
    .from('posts')
    .select()
    .in('id', subquery);

  await assert(inResult.data.length === 1, 'Should resolve subquery and find 1 post');
  await assert(inResult.data[0].id === 'p1', 'Resolved post should be p1');

  // 4. RPC
  tables.user_points = [
    { id: 'up1', user_id: 'user-1', total_points: 80, level: 1 }
  ];
  tables.user_profiles = [
    { id: 'user-1', first_name: 'John', last_name: 'Doe', points: 80 }
  ];

  const rpcResult = await mockSupabaseAdmin.rpc('increment_points', {
    p_user_id: 'user-1',
    p_points: 30
  });

  await assert(rpcResult.error === null, 'RPC error should be null');
  await assert(tables.user_points[0].total_points === 110, 'User points should be 110');
  await assert(tables.user_points[0].level === 2, 'User level should be 2');

  console.log('All custom mockDb assertions PASSED successfully!');
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
