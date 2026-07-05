import { api } from './client.js';

export const postsApi = {
  /** Get paginated feed. Returns { data: posts[], pagination } */
  async getFeed(cursor = null) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const res = await api.get(`/feed${query}`);
    return res; // { data, pagination }
  },

  /** Create a new post */
  async createPost({ title, body, tags = [], attachments = [] }) {
    const res = await api.post('/posts', { title, body, tags, attachments });
    return res.data;
  },

  /** Get a single post by ID */
  async getPost(postId) {
    const res = await api.get(`/posts/${postId}`);
    return res.data;
  },

  /** Update a post */
  async updatePost(postId, updates) {
    const res = await api.patch(`/posts/${postId}`, updates);
    return res.data;
  },

  /** Delete a post */
  async deletePost(postId) {
    const res = await api.delete(`/posts/${postId}`);
    return res.data;
  },

  /** Get posts by a specific user */
  async getUserPosts(userId, cursor = null) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const res = await api.get(`/posts/user/${userId}${query}`);
    return res; // { data, pagination }
  },
};

export const commentsApi = {
  /** Get comments for a post */
  async getComments(postId, cursor = null) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const res = await api.get(`/posts/${postId}/comments${query}`);
    return res; // { data, pagination }
  },

  /** Add a comment to a post */
  async addComment(postId, body) {
    const res = await api.post(`/posts/${postId}/comments`, { body });
    return res.data;
  },

  /** Delete a comment */
  async deleteComment(postId, commentId) {
    const res = await api.delete(`/posts/${postId}/comments/${commentId}`);
    return res.data;
  },
};
