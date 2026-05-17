import { createClient } from "@libsql/client";

const CREATE_PROJECTS = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  root_path TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

const CREATE_SESSIONS = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
`;

const CREATE_MESSAGES = `
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  model TEXT,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
`;

const CREATE_INDEX_MESSAGES_SESSION = `
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
`;

const CREATE_INDEX_MESSAGES_TIMESTAMP = `
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
`;

const CREATE_INDEX_SESSIONS_UPDATED = `
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at);
`;

const CREATE_API_KEYS = `
CREATE TABLE IF NOT EXISTS api_keys (
  provider TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (provider, user_id)
);
`;

const CREATE_USERS = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

const CREATE_USERS_MIGRATE_V2 = `
ALTER TABLE projects ADD COLUMN user_id TEXT;
ALTER TABLE sessions ADD COLUMN user_id TEXT;
ALTER TABLE messages ADD COLUMN user_id TEXT;
ALTER TABLE api_keys ADD COLUMN user_id TEXT;
`;

const CREATE_AUTH_TOKENS = `
CREATE TABLE IF NOT EXISTS auth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
`;

const CREATE_OBSIDIAN_CONFIG = `
CREATE TABLE IF NOT EXISTS obsidian_config (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vault_path TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id)
);
`;

const CREATE_INDEX_USERNAME = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
`;

let migrated = false;

export async function runMigrations(url?: string, authToken?: string) {
  const dbUrl = url || process.env.DATABASE_URL || "file:./data/local.db";
  const token = authToken || process.env.DATABASE_AUTH_TOKEN;

  const client = createClient({
    url: dbUrl,
    ...(token ? { authToken: token } : {}),
  });

  await client.execute(CREATE_PROJECTS);
  await client.execute(CREATE_SESSIONS);
  await client.execute(CREATE_MESSAGES);
  await client.execute(CREATE_API_KEYS);
  await client.execute(CREATE_USERS);
  await client.execute(CREATE_AUTH_TOKENS);
  await client.execute(CREATE_OBSIDIAN_CONFIG);
  await client.execute(CREATE_INDEX_USERNAME);
  // Add userId columns to existing tables (idempotent — fails silently if already present)
  try { await client.execute(CREATE_USERS_MIGRATE_V2); } catch { /* column may already exist */ }
  await client.execute(CREATE_INDEX_MESSAGES_SESSION);
  await client.execute(CREATE_INDEX_MESSAGES_TIMESTAMP);
  await client.execute(CREATE_INDEX_SESSIONS_UPDATED);

  migrated = true;
}

export async function ensureMigrated() {
  if (migrated) return;
  await runMigrations();
}
