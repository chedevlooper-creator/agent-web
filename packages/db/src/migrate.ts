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

const CREATE_MEMORIES = `
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

const CREATE_INDEX_MEMORIES_KEY = `
CREATE INDEX IF NOT EXISTS idx_memories_key ON memories(key);
`;

const MEMORIES_MIGRATE_V3_USER_ID = `ALTER TABLE memories ADD COLUMN user_id TEXT REFERENCES users(id);`;
const MEMORIES_MIGRATE_V3_CATEGORY = `ALTER TABLE memories ADD COLUMN category TEXT NOT NULL DEFAULT 'fact';`;
const MEMORIES_MIGRATE_V3_IMPORTANCE = `ALTER TABLE memories ADD COLUMN importance INTEGER NOT NULL DEFAULT 3;`;
const MEMORIES_MIGRATE_V3_CONTEXT = `ALTER TABLE memories ADD COLUMN context TEXT;`;

const CREATE_INDEX_MEMORIES_USER_CATEGORY = `
CREATE INDEX IF NOT EXISTS idx_memories_user_category ON memories(user_id, category);
`;

const CREATE_INDEX_MEMORIES_USER_IMPORTANCE = `
CREATE INDEX IF NOT EXISTS idx_memories_user_importance ON memories(user_id, importance);
`;

// V4: Knowledge Base tables
const CREATE_KNOWLEDGE_BASES = `
CREATE TABLE IF NOT EXISTS knowledge_bases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

const CREATE_KNOWLEDGE_DOCUMENTS = `
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id TEXT PRIMARY KEY,
  knowledge_base_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text',
  chunk_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

const CREATE_DOCUMENT_CHUNKS = `
CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`;

const CREATE_CHUNKS_FTS = `
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  content,
  content=document_chunks,
  content_rowid=rowid
);
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
  await client.execute(CREATE_MEMORIES);
  await client.execute(CREATE_INDEX_MEMORIES_KEY);

  // V3 migration: add structured memory columns (idempotent — fails silently if already present)
  try { await client.execute(MEMORIES_MIGRATE_V3_USER_ID); } catch { /* column may already exist */ }
  try { await client.execute(MEMORIES_MIGRATE_V3_CATEGORY); } catch { /* column may already exist */ }
  try { await client.execute(MEMORIES_MIGRATE_V3_IMPORTANCE); } catch { /* column may already exist */ }
  try { await client.execute(MEMORIES_MIGRATE_V3_CONTEXT); } catch { /* column may already exist */ }
  try { await client.execute(CREATE_INDEX_MEMORIES_USER_CATEGORY); } catch { /* index may already exist */ }
  try { await client.execute(CREATE_INDEX_MEMORIES_USER_IMPORTANCE); } catch { /* index may already exist */ }

  // V4 migration: knowledge base tables + FTS5
  await client.execute(CREATE_KNOWLEDGE_BASES);
  await client.execute(CREATE_KNOWLEDGE_DOCUMENTS);
  await client.execute(CREATE_DOCUMENT_CHUNKS);
  try { await client.execute(CREATE_CHUNKS_FTS); } catch { /* FTS table may already exist */ }

  migrated = true;
}

export async function ensureMigrated() {
  if (migrated) return;
  await runMigrations();
}
