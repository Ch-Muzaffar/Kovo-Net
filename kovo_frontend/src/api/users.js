import { api } from './client.js';

export const usersApi = {
  /** Get public profile for any user */
  async getProfile(userId) {
    const res = await api.get(`/users/${userId}`);
    return res.data;
  },

  /** Update the current user's profile (bio, avatar_url, skills, departments, hobbies) */
  async updateProfile(updates) {
    const res = await api.patch('/users/me/profile', updates);
    return res.data;
  },

  /** Update the current user's demographics (first_name, last_name, country, city, profession, user_type) */
  async updateDemographics(updates) {
    const res = await api.patch('/users/me/demographics', updates);
    return res.data;
  },

  /** Soft delete the current user's account */
  async deleteAccount() {
    const res = await api.delete('/users/me');
    return res;
  },
};

export const notificationsApi = {
  /** Get all notifications for the current user */
  async getNotifications(cursor = null) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const res = await api.get(`/notifications${query}`);
    return res;
  },

  /** Mark a single notification as read */
  async markRead(notificationId) {
    const res = await api.patch(`/notifications/${notificationId}/read`, {});
    return res.data;
  },

  /** Mark all notifications as read */
  async markAllRead() {
    const res = await api.patch('/notifications/read-all', {});
    return res.data;
  },
};
