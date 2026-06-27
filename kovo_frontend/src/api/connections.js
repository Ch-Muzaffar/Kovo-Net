import { api } from './client.js';

export const connectionsApi = {
  /** Send connection request to another user */
  async sendRequest(receiverId) {
    const res = await api.post('/connections/request', { receiver_id: receiverId });
    return res.data;
  },

  /** Accept or reject a connection request */
  async respondRequest(connectionId, action) {
    const res = await api.post('/connections/respond', { connection_id: connectionId, action });
    return res.data;
  },

  /** Get pending connection requests */
  async getPending() {
    const res = await api.get('/connections/pending');
    return res.data;
  },

  /** Get list of mutually connected friends */
  async getList() {
    const res = await api.get('/connections/list');
    return res.data;
  },

  /** Get connection status with a specific user */
  async getStatus(userId) {
    const res = await api.get(`/connections/status/${userId}`);
    return res.data;
  },

  /** Get count of accepted connections for a user */
  async getCount(userId) {
    const res = await api.get(`/connections/count/${userId}`);
    return res.data;
  },

  /** Withdraw a pending connection request by connection ID */
  async withdrawRequest(connectionId) {
    const res = await api.post('/connections/withdraw', { connection_id: connectionId });
    return res.data;
  }
};
