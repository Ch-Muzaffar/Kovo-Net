import { api } from './client.js';

export const reactionsApi = {
  /** Toggle reaction on a target (message or comment) */
  async toggleReaction(targetId, targetType, emoji) {
    const res = await api.post('/reactions', { targetId, targetType, emoji });
    return res.data;
  }
};
