'use strict';

const env = require('../config/env');
const logger = require('./logger');

let cache;

if (env.REDIS_URL) {
  const Redis = require('ioredis');
  
  class RedisCache {
    constructor(redisUrl, ttlSeconds) {
      this._ttl = ttlSeconds;
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        retryStrategy(times) {
          return Math.min(times * 50, 2000);
        }
      });
      this.client.on('error', (err) => {
        logger.error('Redis client error:', err);
      });
      console.log('[Kovo] Connected to distributed Redis cache');
    }

    async get(key) {
      try {
        const val = await this.client.get(key);
        return val ? JSON.parse(val) : null;
      } catch (err) {
        logger.error(`Redis GET error for key ${key}:`, err);
        return null;
      }
    }

    async set(key, value) {
      try {
        const val = JSON.stringify(value);
        await this.client.set(key, val, 'EX', this._ttl);
      } catch (err) {
        logger.error(`Redis SET error for key ${key}:`, err);
      }
    }

    async invalidate(key) {
      try {
        await this.client.del(key);
      } catch (err) {
        logger.error(`Redis DEL error for key ${key}:`, err);
      }
    }

    async invalidatePattern(prefix) {
      try {
        const keys = await this.client.keys(`${prefix}*`);
        if (keys.length > 0) {
          await this.client.del(keys);
        }
      } catch (err) {
        logger.error(`Redis keys/del error for pattern ${prefix}:`, err);
      }
    }

    async clear() {
      try {
        await this.client.flushdb();
      } catch (err) {
        logger.error('Redis flushdb error:', err);
      }
    }

    destroy() {
      this.client.disconnect();
    }
  }

  cache = new RedisCache(env.REDIS_URL, env.CACHE_TTL_SECONDS || 60);
} else {
  class SimpleCache {
    constructor(ttlMs) {
      this._ttl = ttlMs;
      this._store = new Map();
      this._cleanupInterval = setInterval(() => this._cleanup(), this._ttl);
      if (this._cleanupInterval.unref) this._cleanupInterval.unref();
      console.log('[Kovo] Running with in-memory local cache');
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

  cache = new SimpleCache((env.CACHE_TTL_SECONDS || 60) * 1000);
}

module.exports = cache;
