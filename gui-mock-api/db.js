import path from 'path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbFile = path.join(__dirname, 'data.sqlite');
export const db = new Database(dbFile);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS endpoints (
  id TEXT PRIMARY KEY,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  response TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(method, path)
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS endpoint_vars (
  id TEXT PRIMARY KEY,
  endpoint_id TEXT NOT NULL,
  k TEXT NOT NULL,
  v TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(endpoint_id, k),
  FOREIGN KEY(endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS api_logs (
  id TEXT PRIMARY KEY,
  endpoint_id TEXT,
  method TEXT,
  path TEXT,
  matched_params TEXT, -- JSON
  query TEXT,          -- JSON
  headers TEXT,        -- JSON
  body TEXT,           -- JSON
  status INTEGER,
  response_ms INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(endpoint_id) REFERENCES endpoints(id) ON DELETE SET NULL
);
`);

export function getAllRoutes() {
  return db.prepare('SELECT id, method, path, response, description FROM endpoints ORDER BY path ASC').all();
}

export function saveRoute(route) {
  const now = new Date().toISOString();
  const record = {
    id: route.id,
    method: route.method,
    path: route.path,
    response: route.response,
    description: route.description || '',
    created_at: route.created_at || now,
    updated_at: now
  };

  db.prepare(
    `INSERT INTO endpoints (id, method, path, response, description, created_at, updated_at)
     VALUES (@id, @method, @path, @response, @description, @created_at, @updated_at)
     ON CONFLICT(id) DO UPDATE SET
       method = excluded.method,
       path = excluded.path,
       response = excluded.response,
       description = excluded.description,
       updated_at = excluded.updated_at`
  ).run(record);

  return record;
}

export function listVars(endpointId) {
  return db.prepare('SELECT * FROM endpoint_vars WHERE endpoint_id = ? ORDER BY k ASC').all(endpointId);
}

export function getVarByKey(endpointId, k) {
  return db.prepare('SELECT * FROM endpoint_vars WHERE endpoint_id = ? AND k = ?').get(endpointId, k);
}

export function upsertVar(row) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO endpoint_vars (id, endpoint_id, k, v, created_at, updated_at)
    VALUES (@id, @endpoint_id, @k, @v, @created_at, @updated_at)
    ON CONFLICT(endpoint_id, k) DO UPDATE SET v=excluded.v, updated_at='${now}'
  `).run({ ...row, created_at: row.created_at || now, updated_at: now });
}

export function deleteVar(endpointId, k) {
  db.prepare('DELETE FROM endpoint_vars WHERE endpoint_id = ? AND k = ?').run(endpointId, k);
}

export function insertLog(log) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO api_logs (id, endpoint_id, method, path, matched_params, query, headers, body, status, response_ms, created_at)
    VALUES (@id, @endpoint_id, @method, @path, @matched_params, @query, @headers, @body, @status, @response_ms, @created_at)
  `).run({ ...log, created_at: now });
}

export function listLogs(endpointId, limit = 100, offset = 0) {
  if (endpointId) {
    return db.prepare('SELECT * FROM api_logs WHERE endpoint_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(endpointId, limit, offset);
  }
  return db.prepare('SELECT * FROM api_logs ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
}

export function getLog(id) {
  return db.prepare('SELECT * FROM api_logs WHERE id = ?').get(id);
}

export default {
  db,
  getAllRoutes,
  saveRoute,
  listVars,
  getVarByKey,
  upsertVar,
  deleteVar,
  insertLog,
  listLogs,
  getLog
};
