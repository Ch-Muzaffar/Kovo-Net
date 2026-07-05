import { api } from './client';

/**
 * Submits feedback to the backend.
 * @param {object} data - Feedback data ({ rating, category, message, is_anonymous })
 * @returns {Promise<object>}
 */
export async function submitFeedback(data) {
  return api.post('/feedback', data);
}
