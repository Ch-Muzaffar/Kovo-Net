'use strict';

require('../setup');

jest.mock('@supabase/supabase-js', () => {
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
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockReturnThis(),
  };
  return {
    createClient: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue(mockChain),
      auth: { getUser: jest.fn(), refreshSession: jest.fn() },
      rpc: jest.fn(),
    }),
    __mockChain: mockChain,
  };
});

const { awardHelpfulPoints } = require('../../src/modules/ledger/ledger.service');
const { __mockChain: m } = require('@supabase/supabase-js');
const cache = require('../../src/utils/cache');

describe('Ledger Service — Points & Collusion Controls', () => {
  const sourceUserId = 'source-user-id';
  const targetUserId = 'target-user-id';
  const commentId = 'comment-id';

  beforeEach(() => {
    jest.clearAllMocks();
    cache.clear();
  });

  test('prevents users from marking their own comments as helpful', async () => {
    m.maybeSingle.mockResolvedValueOnce({
      data: { id: commentId, user_id: sourceUserId, post_id: 'post-1', is_hidden: false },
      error: null,
    });

    await expect(awardHelpfulPoints(sourceUserId, commentId)).rejects.toThrow(
      'You cannot mark your own comment as helpful'
    );
  });

  test('enforces IP collusion checks when clientIp matches target last-login IP', async () => {
    m.maybeSingle.mockResolvedValueOnce({
      data: { id: commentId, user_id: targetUserId, post_id: 'post-1', is_hidden: false },
      error: null,
    });

    cache.set(`user-ip:${targetUserId}`, '192.168.1.1');

    await expect(awardHelpfulPoints(sourceUserId, commentId, '192.168.1.1')).rejects.toThrow(
      'Collusion detected: Voter and comment author cannot share the same IP address'
    );
  });

  test('enforces velocity limits (max 2 helpful votes per 24 hours between pairs)', async () => {
    m.maybeSingle.mockResolvedValueOnce({
      data: { id: commentId, user_id: targetUserId, post_id: 'post-1', is_hidden: false },
      error: null,
    });

    // Mock 2 existing recent transactions
    m.gte.mockResolvedValueOnce({
      data: [{ id: 'tx-1' }, { id: 'tx-2' }],
      error: null,
    });

    await expect(awardHelpfulPoints(sourceUserId, commentId)).rejects.toThrow(
      'Velocity limit exceeded: You can only mark comments from this user as helpful 2 times per 24 hours'
    );
  });

  test('enforces daily points accumulation cap of 50 points', async () => {
    // 1st mock for comment check
    m.maybeSingle.mockResolvedValueOnce({
      data: { id: commentId, user_id: targetUserId, post_id: 'post-1', is_hidden: false },
      error: null,
    });

    // 2nd mock for recent votes between pairs (0 votes)
    m.gte.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    // 3rd mock for daily accumulation cap check (already earned 50 points)
    m.gte.mockResolvedValueOnce({
      data: [{ points_awarded: 30 }, { points_awarded: 20 }],
      error: null,
    });

    await expect(awardHelpfulPoints(sourceUserId, commentId)).rejects.toThrow(
      'Daily accumulation cap exceeded: This contributor has reached their maximum daily reputation points'
    );
  });
});
