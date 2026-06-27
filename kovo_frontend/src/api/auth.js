import { api, tokenStorage } from './client.js';

export const authApi = {
  /** Register a new user — returns { user, session } */
  async register(email, password) {
    const res = await api.post('/auth/register', { email, password });
    const { user, session } = res.data;
    tokenStorage.setTokens(session.accessToken, session.refreshToken);
    tokenStorage.setUser(user);
    return { user, session };
  },

  /** Sign in — returns { user, session } */
  async login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    const { user, session } = res.data;
    tokenStorage.setTokens(session.accessToken, session.refreshToken);
    tokenStorage.setUser(user);
    return { user, session };
  },

  /** Create user profile (step 2 after register) */
  async onboard(data) {
    const res = await api.post('/auth/onboard', {
      username: data.username,
      first_name: data.firstName,
      last_name: data.lastName,
      date_of_birth: data.dob,
      country: data.country,
      city: data.city,
      profession: data.profession,
      user_type: data.userType,
    });
    return res.data;
  },

  /** Check if a username is available */
  async checkUsername(username) {
    const res = await api.get(`/auth/check-username?username=${encodeURIComponent(username)}`);
    return res.data;
  },

  /** Accept Terms of Service (step 3 after onboard) */
  async acceptTos() {
    const res = await api.post('/auth/accept-tos', { accepted: true });
    return res.data;
  },

  /** Get current user profile */
  async me() {
    const res = await api.get('/auth/me');
    return res.data;
  },

  /** Logout — blacklists the token */
  async logout() {
    try { await api.post('/auth/logout', {}); } catch { /* best effort */ }
    tokenStorage.clear();
  },
};
