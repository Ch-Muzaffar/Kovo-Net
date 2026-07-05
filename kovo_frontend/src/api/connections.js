import { api } from './client.js';

export const connectionsApi = {
  _receivedPromise: null,
  _sentPromise: null,

  /** Send connection request to another user */
  async sendRequest(receiverId) {
    this.invalidateCache();
    const res = await api.post('/connections/request', { receiver_id: receiverId });
    return res.data;
  },

  /** Accept or reject a connection request */
  async respondRequest(connectionId, action) {
    this.invalidateCache();
    const res = await api.post('/connections/respond', { connection_id: connectionId, action });
    return res.data;
  },

  /** Get pending connection requests */
  async getPending() {
    const res = await api.get('/connections/pending');
    return res.data;
  },

  /** Get received pending connection requests */
  async getReceivedPending() {
    if (window.__KOVO_PREFETCHED_CONNECTIONS__ && window.__KOVO_PREFETCHED_CONNECTIONS__.received) {
      this._receivedPromise = window.__KOVO_PREFETCHED_CONNECTIONS__.received;
      delete window.__KOVO_PREFETCHED_CONNECTIONS__.received;
      if (Object.keys(window.__KOVO_PREFETCHED_CONNECTIONS__).length === 0) {
        delete window.__KOVO_PREFETCHED_CONNECTIONS__;
      }
    }
    if (!this._receivedPromise) {
      this._receivedPromise = api.get('/connections/pending/received').then(res => res.data);
    }
    return this._receivedPromise;
  },

  /** Get sent pending connection requests */
  async getSentPending() {
    if (window.__KOVO_PREFETCHED_CONNECTIONS__ && window.__KOVO_PREFETCHED_CONNECTIONS__.sent) {
      this._sentPromise = window.__KOVO_PREFETCHED_CONNECTIONS__.sent;
      delete window.__KOVO_PREFETCHED_CONNECTIONS__.sent;
      if (Object.keys(window.__KOVO_PREFETCHED_CONNECTIONS__).length === 0) {
        delete window.__KOVO_PREFETCHED_CONNECTIONS__;
      }
    }
    if (!this._sentPromise) {
      this._sentPromise = api.get('/connections/pending/sent').then(res => res.data);
    }
    return this._sentPromise;
  },

  /** Accept a connection request via PUT */
  async acceptRequest(connectionId) {
    this.invalidateCache();
    const res = await api.put(`/connections/${connectionId}/accept`);
    return res.data;
  },

  /** Delete, ignore, or withdraw a connection request via DELETE */
  async deleteRequest(connectionId) {
    this.invalidateCache();
    const res = await api.delete(`/connections/${connectionId}`);
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
    this.invalidateCache();
    const res = await api.post('/connections/withdraw', { connection_id: connectionId });
    return res.data;
  },

  /** Remove / unfriend a connection by connection ID */
  async removeConnection(connectionId) {
    this.invalidateCache();
    const res = await api.post('/connections/remove', { connection_id: connectionId });
    return res.data;
  },

  /** Prefetch pending requests in parallel */
  prefetchPending() {
    if (window.__KOVO_PREFETCHED_CONNECTIONS__) {
      if (window.__KOVO_PREFETCHED_CONNECTIONS__.received && !this._receivedPromise) {
        this._receivedPromise = window.__KOVO_PREFETCHED_CONNECTIONS__.received;
        delete window.__KOVO_PREFETCHED_CONNECTIONS__.received;
      }
      if (window.__KOVO_PREFETCHED_CONNECTIONS__.sent && !this._sentPromise) {
        this._sentPromise = window.__KOVO_PREFETCHED_CONNECTIONS__.sent;
        delete window.__KOVO_PREFETCHED_CONNECTIONS__.sent;
      }
      if (Object.keys(window.__KOVO_PREFETCHED_CONNECTIONS__).length === 0) {
        delete window.__KOVO_PREFETCHED_CONNECTIONS__;
      }
    }
    if (!this._receivedPromise) {
      this._receivedPromise = api.get('/connections/pending/received').then(res => res.data);
    }
    if (!this._sentPromise) {
      this._sentPromise = api.get('/connections/pending/sent').then(res => res.data);
    }
  },

  /** Invalidate the pending requests cache */
  invalidateCache() {
    this._receivedPromise = null;
    this._sentPromise = null;
  }
};
