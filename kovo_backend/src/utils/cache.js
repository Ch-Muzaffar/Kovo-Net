'use strict';

const env = require('../config/env');

/**
 * In-memory cache with TTL and periodic cleanup.
 * Sized for pilot phase (500 users). Replace with Redis for scale.
 */
class SimpleCache {
  constructor(ttlMs) {
    this._ttl = ttlMs;
    this._store = new Map();
    this._cleanupInterval = setInterval(() => this._cleanup(), this._ttl);
    if (this._cleanupInterval.unref) this._cleanupInterval.unref();
  }

  get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.exp) {
      this._store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value) {
    this._store.set(key, { value, exp: Date.now() + this._ttl });
  }

  invalidate(key) {
    this._store.delete(key);
  }

  invalidatePattern(prefix) {
    for (const key of this._store.keys()) {
      if (key.startsWith(prefix)) this._store.delete(key);
    }
  }

  clear() {
    this._store.clear();
  }

  size() {
    return this._store.size;
  }

  _cleanup() {
    const now = Date.now();
    for (const [key, entry] of this._store) {
      if (now > entry.exp) this._store.delete(key);
    }
  }

  destroy() {
    clearInterval(this._cleanupInterval);
    this._store.clear();
  }
}

const cache = new SimpleCache(env.CACHE_TTL_SECONDS * 1000);

module.exports = cache;
