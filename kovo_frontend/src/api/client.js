/**
 * Base API client for KOVO NETWORKS.
 * Auto-attaches JWT, handles 401 refresh, and provides typed request helpers.
 */

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

// ─── Token helpers ───
export const tokenStorage = {
  getAccess: () => localStorage.getItem('kovo_access_token'),
  getRefresh: () => localStorage.getItem('kovo_refresh_token'),
  setTokens: (access, refresh) => {
    if (access) localStorage.setItem('kovo_access_token', access);
    if (refresh) localStorage.setItem('kovo_refresh_token', refresh);
  },
  clear: () => {
    localStorage.removeItem('kovo_access_token');
    localStorage.removeItem('kovo_refresh_token');
    localStorage.removeItem('kovo_user');
  },
  getUser: () => {
    try { return JSON.parse(localStorage.getItem('kovo_user') || 'null'); }
    catch { return null; }
  },
  setUser: (user) => localStorage.setItem('kovo_user', JSON.stringify(user)),
};

// ─── Refresh in-flight guard ───
let _refreshPromise = null;

async function _refreshTokens() {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    const rt = tokenStorage.getRefresh();
    if (!rt) throw new Error('No refresh token');
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!res.ok) {
      tokenStorage.clear();
      throw new Error('Session expired. Please sign in again.');
    }
    const json = await res.json();
    const { accessToken, refreshToken } = json.data;
    tokenStorage.setTokens(accessToken, refreshToken);
    return accessToken;
  })().finally(() => { _refreshPromise = null; });
  return _refreshPromise;
}

// ─── Core request function ───
export async function apiRequest(path, options = {}, retry = true) {
  const token = tokenStorage.getAccess();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  // Auto-refresh on 401 TOKEN_EXPIRED
  if (res.status === 401 && retry) {
    let body;
    try { body = await res.clone().json(); } catch { body = {}; }
    if (body?.code === 'TOKEN_EXPIRED' || body?.error?.code === 'TOKEN_EXPIRED') {
      try {
        const newToken = await _refreshTokens();
        return apiRequest(path, options, false);
      } catch {
        throw new ApiError('Session expired. Please sign in again.', 401, 'SESSION_EXPIRED');
      }
    }
  }

  if (!res.ok) {
    let errorBody;
    try { errorBody = await res.json(); } catch { errorBody = { message: res.statusText }; }
    const rawError = errorBody?.error;
    const message = (typeof rawError === 'string' ? rawError : rawError?.message) || errorBody?.message || `Request failed (${res.status})`;
    const errorCode = (typeof rawError === 'object' ? rawError?.code : errorBody?.code) || 'API_ERROR';
    throw new ApiError(message, res.status, errorCode);
  }

  return res.json();
}

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ─── Convenience methods ───
export const api = {
  get: (path, opts) => apiRequest(path, { method: 'GET', ...opts }),
  post: (path, body, opts) => apiRequest(path, { method: 'POST', body: JSON.stringify(body), ...opts }),
  patch: (path, body, opts) => apiRequest(path, { method: 'PATCH', body: JSON.stringify(body), ...opts }),
  delete: (path, opts) => apiRequest(path, { method: 'DELETE', ...opts }),
};
