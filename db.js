'use strict';

const Database = require('better-sqlite3');
const path = require('path');

let _db = null;

function getDb() {
  if (_db) return _db;

  const dbPath = process.env.DB_PATH || './krynolux.db';
  _db = new Database(path.resolve(dbPath));

  // WAL mode: much faster for concurrent reads
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  createTables(_db);
  return _db;
}

function createTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      email       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      password    TEXT    NOT NULL,
      level       TEXT    NOT NULL DEFAULT 'grade_10',
      verified    INTEGER NOT NULL DEFAULT 0,
      banned      INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS otps (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT    NOT NULL COLLATE NOCASE,
      code_hash     TEXT    NOT NULL,
      purpose       TEXT    NOT NULL CHECK(purpose IN ('verify','reset')),
      expires_at    TEXT    NOT NULL,
      resend_count  INTEGER NOT NULL DEFAULT 0,
      used          INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admins (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL UNIQUE,
      role          TEXT    DEFAULT 'admin',
      permissions   TEXT,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL,
      token_hash    TEXT    NOT NULL,
      last_heartbeat TEXT   DEFAULT (datetime('now')),
      expires_at    TEXT    NOT NULL,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id      INTEGER NOT NULL,
      action        TEXT    NOT NULL,
      target_user_id INTEGER,
      details       TEXT,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS jump_scare_history (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id      INTEGER NOT NULL,
      target_user_id INTEGER NOT NULL,
      triggered_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_heartbeat ON sessions(last_heartbeat);
    CREATE INDEX IF NOT EXISTS idx_audit_admin ON audit_log(admin_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_scare_admin ON jump_scare_history(admin_id, triggered_at);
  `);
}

module.exports = { getDb };
