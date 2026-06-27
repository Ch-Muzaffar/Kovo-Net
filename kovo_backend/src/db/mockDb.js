'use strict';

/**
 * In-memory mock database for local development.
 * Replaces Supabase when USE_MOCK_DB=true in .env
 * All data resets on server restart.
 */

const { v4: uuid } = require('uuid');

// ─── Tables ───
const tables = {
  users: [],         // { id, email, password_hash, created_at }
  user_profiles: [], // { id, first_name, last_name, date_of_birth, country, city, profession, user_type, avatar_url, bio, is_profile_complete, tos_accepted, tos_accepted_at, banned, banned_reason, points }
  user_points: [],   // { user_id, points }
  posts: [],         // { id, user_id, title, body, attachments, tags, is_hidden, created_at, updated_at }
  post_tags: [],     // { id, post_id, tag_type, tag_value }
  comments: [],      // { id, post_id, user_id, body, is_hidden, helpful, created_at }
  notifications: [], // { id, user_id, type, content, read, post_id, from_user_id, created_at }
  token_blacklist: [],
  sessions: [],      // { id, user_id, access_token, refresh_token, expires_at }
  direct_messages: [],
  ledger_transactions: [],
  reports: [],
  connections: [],
};
// No seed data (empty database)

function evaluateCondition(row, condStr) {
  const parts = condStr.split('.');
  if (parts.length < 3) return false;
  const field = parts[0];
  const op = parts[1];
  const val = parts.slice(2).join('.');
  
  if (op === 'eq') {
    return String(row[field]) === val;
  }
  if (op === 'neq') {
    return String(row[field]) !== val;
  }
  if (op === 'ilike') {
    const escaped = val.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const pattern = escaped.replace(/%/g, '.*');
    const regex = new RegExp(val.includes('%') ? `^${pattern}$` : `^${escaped}$`, 'i');
    return regex.test(String(row[field] || ''));
  }
  return false;
}

function evaluateOr(row, orString) {
  if (orString.includes('and(')) {
    const clauses = [];
    let current = '';
    let depth = 0;
    for (let i = 0; i < orString.length; i++) {
      const char = orString[i];
      if (char === '(') depth++;
      if (char === ')') depth--;
      if (char === ',' && depth === 0) {
        clauses.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    if (current) clauses.push(current);

    return clauses.some(clause => {
      if (clause.startsWith('and(') && clause.endsWith(')')) {
        const inner = clause.substring(4, clause.length - 1);
        const conds = inner.split(',');
        return conds.every(cond => evaluateCondition(row, cond));
      }
      return evaluateCondition(row, clause);
    });
  } else {
    const conds = orString.split(',');
    return conds.some(cond => evaluateCondition(row, cond));
  }
}

// ─── Query builder mock ───
class MockQuery {
  constructor(tableName) {
    this._table = tableName;
    this._data = tables[tableName] ? [...tables[tableName]] : [];
    this._filters = [];
    this._selectFields = null;
    this._insertData = null;
    this._updateData = null;
    this._deleteMode = false;
    this._single = false;
    this._maybeSingle = false;
    this._limit = null;
    this._order = null;
    this._count = false;
    this._upsert = false;
    this._ltField = null;
    this._ltValue = null;
    this._gtField = null;
    this._gtValue = null;
  }

  select(fields, opts = {}) {
    this._selectFields = fields;
    if (opts.count === 'exact') this._count = true;
    return this;
  }

  insert(data) {
    this._insertData = data;
    return this;
  }

  update(data) {
    this._updateData = data;
    return this;
  }

  delete() {
    this._deleteMode = true;
    return this;
  }

  upsert(data) {
    this._upsert = true;
    this._insertData = data;
    return this;
  }

  eq(field, value) {
    this._filters.push({ type: 'eq', field, value });
    return this;
  }

  neq(field, value) {
    this._filters.push({ type: 'neq', field, value });
    return this;
  }

  lt(field, value) {
    this._ltField = field;
    this._ltValue = value;
    return this;
  }

  gt(field, value) {
    this._gtField = field;
    this._gtValue = value;
    return this;
  }

  in(field, values) {
    this._filters.push({ type: 'in', field, values });
    return this;
  }

  ilike(field, value) {
    this._filters.push({ type: 'ilike', field, value });
    return this;
  }

  or(filtersStr) {
    this._filters.push({ type: 'or', value: filtersStr });
    return this;
  }

  single() {
    this._single = true;
    return this._execute();
  }

  maybeSingle() {
    this._maybeSingle = true;
    return this._execute();
  }

  limit(n) {
    this._limit = n;
    return this;
  }

  order(field, opts = {}) {
    this._order = { field, ascending: opts.ascending !== false };
    return this;
  }

  then(resolve, reject) {
    return Promise.resolve(this._execute()).then(resolve, reject);
  }

  _applyFilters(rows) {
    return rows.filter(row => {
      return this._filters.every(f => {
        if (f.type === 'eq')  return row[f.field] === f.value;
        if (f.type === 'neq') return row[f.field] !== f.value;
        if (f.type === 'in')  return f.values.includes(row[f.field]);
        if (f.type === 'or')  return evaluateOr(row, f.value);
        if (f.type === 'ilike') {
          const val = String(f.value || '');
          const escaped = val.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const pattern = escaped.replace(/%/g, '.*');
          const regex = new RegExp(val.includes('%') ? `^${pattern}$` : `^${escaped}$`, 'i');
          return regex.test(String(row[f.field] || ''));
        }
        return true;
      });
    });
  }

  _projectFields(row) {
    if (!this._selectFields || this._selectFields === '*') return row;

    // Handle joins like "*, creator:user_profiles(id, first_name, last_name, avatar_url)"
    const parts = this._selectFields.split(',').map(s => s.trim());
    const result = {};
    for (const part of parts) {
      if (part === '*') {
        Object.assign(result, row);
      } else if (part.includes(':')) {
        // join like "creator:user_profiles(id, first_name, last_name)"
        const [alias, rest] = part.split(':');
        const tablePart = rest.match(/^(\w+)\((.+)\)$/);
        if (tablePart) {
          const joinTable = tablePart[1];
          const joinFields = tablePart[2].split(',').map(s => s.trim());
          const foreignKey = row.user_id || row.id;
          const joinRow = tables[joinTable]?.find(r => r.id === foreignKey) || null;
          if (joinRow) {
            result[alias] = joinFields.reduce((acc, f) => { acc[f] = joinRow[f]; return acc; }, {});
          } else {
            result[alias] = null;
          }
        }
      } else {
        if (part in row) result[part] = row[part];
      }
    }
    return result;
  }

  async _execute() {
    const table = tables[this._table];
    if (!table) return { data: null, error: { message: `Table ${this._table} not found` } };

    try {
      // Resolve subqueries for `in` filters
      for (const f of this._filters) {
        if (f.type === 'in' && f.values instanceof MockQuery) {
          const subqueryResult = await f.values._execute();
          if (subqueryResult.error) {
            return { data: null, error: subqueryResult.error };
          }
          const subqueryField = f.values._selectFields || 'id';
          f.values = (subqueryResult.data || []).map(row => row[subqueryField]);
        }
      }

      // INSERT
      if (this._insertData && !this._deleteMode && !this._updateData) {
        const items = Array.isArray(this._insertData) ? this._insertData : [this._insertData];
        const inserted = items.map(item => {
          const defaults = {};
          if (this._table === 'user_profiles') {
            defaults.tos_accepted = false;
            defaults.is_profile_complete = false;
            defaults.banned = false;
            defaults.points = 0;
          } else if (this._table === 'posts') {
            defaults.is_hidden = false;
          } else if (this._table === 'comments') {
            defaults.is_hidden = false;
            defaults.helpful = false;
          } else if (this._table === 'notifications') {
            defaults.read = false;
          } else if (this._table === 'connections') {
            defaults.status = 'pending';
          }
          const row = { id: uuid(), created_at: new Date().toISOString(), ...defaults, ...item };
          if (this._upsert) {
            const idx = table.findIndex(r => r.id === row.id);
            if (idx >= 0) { table[idx] = { ...table[idx], ...row }; return table[idx]; }
          }
          table.push(row);
          return row;
        });
        const result = this._single || this._maybeSingle ? inserted[0] : inserted;
        const projected = this._single || this._maybeSingle
          ? this._projectFields(result)
          : inserted.map(r => this._projectFields(r));
        return { data: projected, error: null };
      }

      // DELETE
      if (this._deleteMode) {
        let filtered = this._applyFilters(table);
        const toDelete = new Set(filtered.map(r => r.id));
        const before = table.length;
        tables[this._table] = table.filter(r => !toDelete.has(r.id));
        return { data: null, error: null, count: before - tables[this._table].length };
      }

      // UPDATE
      if (this._updateData) {
        let filtered = this._applyFilters(table);
        const updatedRows = [];
        filtered.forEach(row => {
          const idx = table.findIndex(r => r.id === row.id);
          if (idx >= 0) {
            table[idx] = { ...table[idx], ...this._updateData };
            updatedRows.push(table[idx]);
          }
        });
        const result = this._single || this._maybeSingle ? updatedRows[0] || null : updatedRows;
        const projected = result
          ? (this._single || this._maybeSingle ? this._projectFields(result) : updatedRows.map(r => this._projectFields(r)))
          : null;
        if ((this._single || this._maybeSingle) && !result) {
          return { data: null, error: { message: 'No rows updated' } };
        }
        return { data: projected, error: null };
      }

      // SELECT
      let rows = this._applyFilters(table);
      if (this._ltField) {
        rows = rows.filter(r => r[this._ltField] < this._ltValue);
      }
      if (this._gtField) {
        rows = rows.filter(r => r[this._gtField] > this._gtValue);
      }
      if (this._order) {
        rows.sort((a, b) => {
          const va = a[this._order.field], vb = b[this._order.field];
          if (va < vb) return this._order.ascending ? -1 : 1;
          if (va > vb) return this._order.ascending ? 1 : -1;
          return 0;
        });
      }
      const totalCount = rows.length;
      if (this._limit) rows = rows.slice(0, this._limit);
      const projected = rows.map(r => this._projectFields(r));

      if (this._single) {
        return projected.length > 0
          ? { data: projected[0], error: null }
          : { data: null, error: { message: 'No rows found' } };
      }
      if (this._maybeSingle) {
        return { data: projected[0] || null, error: null };
      }
      const res = { data: projected, error: null };
      if (this._count) res.count = totalCount;
      return res;

    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  }

  // Expose table access for auth invalidation
  _invalidate(pattern) {
    // no-op for mock
  }
}

// ─── Mock Auth ───
const mockAuth = {
  admin: {
    async createUser({ email, password }) {
      const exists = tables.users.find(u => u.email === email);
      if (exists) return { data: null, error: { message: 'User already registered' } };
      const id = `user ${tables.users.length + 1}`;
      const user = { id, email, password_hash: password, created_at: new Date().toISOString() };
      tables.users.push(user);
      return { data: { user: { id: user.id, email: user.email } }, error: null };
    }
  },

  async signUp({ email, password }) {
    const exists = tables.users.find(u => u.email === email);
    if (exists) return { data: null, error: { message: 'User already registered' } };
    const id = `user ${tables.users.length + 1}`;
    const user = { id, email, password_hash: password, created_at: new Date().toISOString() };
    tables.users.push(user);
    const session = _createSession(user);
    return { data: { user: { id: user.id, email: user.email }, session }, error: null };
  },

  async signInWithPassword({ email, password }) {
    const user = tables.users.find(u => u.email === email && u.password_hash === password);
    if (!user) return { data: null, error: { message: 'Invalid login credentials' } };
    const session = _createSession(user);
    return { data: { user: { id: user.id, email: user.email }, session }, error: null };
  },

  async getUser(token) {
    const session = tables.sessions.find(s => s.access_token === token);
    if (!session || new Date(session.expires_at) < new Date()) {
      return { data: { user: null }, error: { message: 'Invalid token' } };
    }
    const user = tables.users.find(u => u.id === session.user_id);
    return { data: { user: user ? { id: user.id, email: user.email } : null }, error: null };
  },

  async refreshSession({ refresh_token }) {
    const session = tables.sessions.find(s => s.refresh_token === refresh_token);
    if (!session) return { data: null, error: { message: 'Invalid refresh token' } };
    const user = tables.users.find(u => u.id === session.user_id);
    if (!user) return { data: null, error: { message: 'User not found' } };
    // Create new session
    const newSession = _createSession(user);
    // Remove old
    const idx = tables.sessions.findIndex(s => s.refresh_token === refresh_token);
    if (idx >= 0) tables.sessions.splice(idx, 1);
    return { data: { session: newSession }, error: null };
  },
};

function _createSession(user) {
  const jwt = require('jsonwebtoken');
  const env = require('../config/env');
  const jti = require('uuid').v4();
  const expiresIn = 3600; // 1 hour
  const access_token = jwt.sign(
    { sub: user.id, email: user.email, role: 'authenticated', jti },
    env.SUPABASE_JWT_SECRET,
    { algorithm: 'HS256', expiresIn }
  );
  const refresh_token = require('uuid').v4();
  const session = {
    access_token,
    refresh_token,
    expires_in: expiresIn,
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    user_id: user.id,
  };
  tables.sessions.push(session);
  return session;
}

// ─── Mock Supabase client ───
const mockSupabaseAdmin = {
  auth: mockAuth,
  from(tableName) {
    return new MockQuery(tableName);
  },
  async rpc(funcName, args) {
    if (funcName === 'increment_points') {
      const { p_user_id, p_points } = args;
      let record = tables.user_points.find(up => up.user_id === p_user_id);
      if (!record) {
        record = {
          id: uuid(),
          user_id: p_user_id,
          total_points: 0,
          level: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        tables.user_points.push(record);
      }
      record.total_points += p_points;
      record.level = Math.max(1, Math.floor(record.total_points / 100) + 1);
      record.updated_at = new Date().toISOString();
      
      const profile = tables.user_profiles.find(up => up.id === p_user_id);
      if (profile) {
        profile.points = record.total_points;
      }
      
      return { data: null, error: null };
    }
    return { data: null, error: { message: `Function ${funcName} not found` } };
  }
};

function createMockUserClient(token) {
  return mockSupabaseAdmin;
}

module.exports = { mockSupabaseAdmin, createMockUserClient, tables };
