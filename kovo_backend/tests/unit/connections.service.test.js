'use strict';

require('../setup');

jest.mock('../../src/config/supabase', () => {
  const { mockSupabaseAdmin } = require('../../src/db/mockDb');
  return {
    supabaseAdmin: mockSupabaseAdmin
  };
});

const { 
  sendRequest, 
  respondRequest, 
  getPendingRequests, 
  getConnectionsList, 
  getConnectionStatus, 
  getConnectionCount 
} = require('../../src/modules/connections/connections.service');
const { tables } = require('../../src/db/mockDb');

describe('Connections Service', () => {
  const userA = '00000000-0000-0000-0000-00000000000a';
  const userB = '00000000-0000-0000-0000-00000000000b';
  const userC = '00000000-0000-0000-0000-00000000000c';

  beforeEach(() => {
    tables.connections = [];
    tables.user_profiles = [
      { id: userA, first_name: 'Alice', last_name: 'Smith', points: 100, is_profile_complete: true },
      { id: userB, first_name: 'Bob', last_name: 'Jones', points: 150, is_profile_complete: true },
      { id: userC, first_name: 'Charlie', last_name: 'Brown', points: 50, is_profile_complete: true }
    ];
    tables.notifications = [];
  });

  test('cannot connect to self', async () => {
    await expect(sendRequest(userA, userA)).rejects.toThrow('You cannot connect with yourself');
  });

  test('send connection request successfully', async () => {
    const req = await sendRequest(userA, userB);
    expect(req).toBeDefined();
    expect(req.sender_id).toBe(userA);
    expect(req.receiver_id).toBe(userB);
    expect(req.status).toBe('pending');

    // Notification created
    expect(tables.notifications).toHaveLength(1);
    expect(tables.notifications[0].user_id).toBe(userB);
    expect(tables.notifications[0].type).toBe('connection_request');
  });

  test('cannot send duplicate pending request', async () => {
    await sendRequest(userA, userB);
    await expect(sendRequest(userA, userB)).rejects.toThrow('Connection request already sent');
  });

  test('mutually accepts if the other user already requested', async () => {
    // B requests A
    await sendRequest(userB, userA);
    // A now requests B
    const conn = await sendRequest(userA, userB);
    expect(conn.status).toBe('accepted');
  });

  test('respond to request (accept)', async () => {
    const req = await sendRequest(userA, userB);
    const updated = await respondRequest(userB, req.id, 'accept');
    expect(updated.status).toBe('accepted');

    // Status is connected
    const status = await getConnectionStatus(userA, userB);
    expect(status.status).toBe('connected');

    // Count connections
    const countA = await getConnectionCount(userA);
    const countB = await getConnectionCount(userB);
    expect(countA).toBe(1);
    expect(countB).toBe(1);
  });

  test('respond to request (reject)', async () => {
    const req = await sendRequest(userA, userB);
    const updated = await respondRequest(userB, req.id, 'reject');
    expect(updated.status).toBe('rejected');

    // Status is rejected
    const status = await getConnectionStatus(userA, userB);
    expect(status.status).toBe('rejected');
  });

  test('getPendingRequests returns sender details', async () => {
    const req = await sendRequest(userA, userB);
    const pending = await getPendingRequests(userB);
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(req.id);
    expect(pending[0].sender.first_name).toBe('Alice');
  });

  test('getConnectionsList returns mutually connected partner profiles', async () => {
    const req = await sendRequest(userA, userB);
    await respondRequest(userB, req.id, 'accept');

    const listA = await getConnectionsList(userA);
    expect(listA).toHaveLength(1);
    expect(listA[0].first_name).toBe('Bob');

    const listB = await getConnectionsList(userB);
    expect(listB).toHaveLength(1);
    expect(listB[0].first_name).toBe('Alice');
  });

  test('supports username resolution in connection functions', async () => {
    const req = await sendRequest(userA, 'bob.jones');
    expect(req.receiver_id).toBe(userB);

    const status = await getConnectionStatus(userA, 'bob.jones');
    expect(status.status).toBe('pending_sent');

    const count = await getConnectionCount('bob.jones');
    expect(count).toBe(0);
  });
});
