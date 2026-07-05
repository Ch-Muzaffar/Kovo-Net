import { api } from './client.js';

export const messagesApi = {
  /** Fetch all active conversations/chats for the current user */
  async getConversations() {
    const res = await api.get('/messages/conversations');
    return res.data;
  },

  /** Fetch messages in a specific conversation with a user */
  async getConversationMessages(otherUserId, cursor = null) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const res = await api.get(`/messages/conversation/${otherUserId}${query}`);
    return res;
  },

  /** Send a direct message */
  async sendMessage(receiverId, body, postId = null) {
    const res = await api.post('/messages', {
      receiver_id: receiverId,
      body,
      post_id: postId
    });
    return res.data;
  }
};
