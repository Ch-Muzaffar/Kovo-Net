'use strict';

require('../setup');
const { supabaseAdmin } = require('../../src/config/supabase');
const { sendMessage, getConversations, getConversationMessages } = require('../../src/modules/messages/messages.service');

describe('Messages Service — Integration Test with Real Database', () => {
  let userA = null;
  let userB = null;
  let insertedMessageId = null;

  beforeAll(async () => {
    // Dynamically retrieve two existing completed, non-banned user profiles from the real database
    const { data: profiles, error } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('banned', false)
      .limit(2);

    if (error) {
      throw new Error('Failed to fetch user profiles for integration test: ' + error.message);
    }

    if (!profiles || profiles.length < 2) {
      throw new Error('Integration test requires at least 2 users in the database to run.');
    }

    userA = profiles[0].id;
    userB = profiles[1].id;
  });

  afterAll(async () => {
    // Cleanup: Delete the inserted direct message to keep the real database clean
    if (insertedMessageId) {
      await supabaseAdmin
        .from('direct_messages')
        .delete()
        .eq('id', insertedMessageId);
    }
  });

  test('sends a direct message between two real users', async () => {
    const textBody = `Integration Test Message — ${Date.now()}`;
    const message = await sendMessage(userA, {
      receiver_id: userB,
      body: textBody
    });

    expect(message).toBeDefined();
    expect(message.id).toBeDefined();
    expect(message.body).toBe(textBody);
    
    insertedMessageId = message.id;
  });

  test('fetches conversations containing the sent message', async () => {
    expect(insertedMessageId).not.toBeNull();

    const { data: conversations } = await getConversations(userA);
    expect(conversations).toBeDefined();
    expect(conversations.length).toBeGreaterThan(0);

    const match = conversations.find(c => c.partner.id === userB);
    expect(match).toBeDefined();
    expect(match.lastMessage.body).toContain('Integration Test Message');
  });

  test('fetches messages for the conversation', async () => {
    expect(insertedMessageId).not.toBeNull();

    const { data: messages } = await getConversationMessages(userA, userB, { pageSize: 10 });
    expect(messages).toBeDefined();
    expect(messages.length).toBeGreaterThan(0);

    const match = messages.find(m => m.id === insertedMessageId);
    expect(match).toBeDefined();
    expect(match.body).toContain('Integration Test Message');
  });
});
