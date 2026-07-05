import { api } from './client.js';

export const ledgerApi = {
  /** Award points for a helpful comment */
  async awardHelpfulPoints(commentId) {
    const res = await api.post('/ledger/award', { commentId });
    return res.data;
  }
};
