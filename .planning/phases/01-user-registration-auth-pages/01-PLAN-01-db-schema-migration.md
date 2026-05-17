---
id: 01-user-registration-auth-pages-plan01
phase: 1
wave: 1
depends_on: []
files_modified:
  - packages/db/src/schema.ts
  - packages/db/src/migrate.ts
  - packages/db/src/index.ts
autonomous: true
requirements:
  - DB-01
  - AUTH-07
---

# Plan 01: Database Schema & Migration

## Objective

Create the `users` table in Drizzle schema, add migration SQL, and add `auth_tokens` table for session management.

## Tasks

### Task 1.1: Add `users` table to schema

<read_first>
- packages/db/src/schema.ts (existing schema pattern — projects, sessions, messages, api_keys)
- packages/db/src/index.ts (re-export pattern)
</read_first>

<action>
In `packages/db/src/schema.ts`:

1. Add a `users` table after the existing `apiKeys` definition using `sqliteTable("users", {...})`
2. Columns: `id` (text, primaryKey), `username` (text, notNull, unique), `passwordHash` (text, notNull), `createdAt` (integer, notNull), `updatedAt` (integer, notNull)
3. Add `uniqueIndex("username_idx").on(users.username)` for uniqueness enforcement
4. Export `User` type using `typeof users.$inferSelect` and `NewUser` using `typeof users.$inferInsert`
5. Add `auth_tokens` table: `id` (text, primaryKey), `userId` (text, notNull, references users.id), `token` (text, notNull, unique), `expiresAt` (integer, notNull), `createdAt` (integer, notNull)
6. Add uniqueIndex on token column
7. Export `AuthToken` and `NewAuthToken` types
</action>

<acceptance_criteria>
- `packages/db/src/schema.ts` contains `users` table with all 5 columns
- `packages/db/src/schema.ts` contains `auth_tokens` table with all 5 columns
- `User`, `NewUser`, `AuthToken`, `NewAuthToken` types are exported
- `uniqueIndex("username_idx").on(users.username)` is defined
- `pnpm --filter @agent-web/db build` succeeds
</acceptance_criteria>

### Task 1.2: Add migration SQL

<read_first>
- packages/db/src/migrate.ts (existing runMigrations pattern with raw SQL)
</read_first>

<action>
In `packages/db/src/migrate.ts`:

1. Add SQL constant for `users` table creation:
```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```
2. Add SQL constant for `auth_tokens` table:
```sql
CREATE TABLE IF NOT EXISTS auth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
```
3. Add `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);`
4. Append both CREATE TABLE statements inside `runMigrations()`
</action>

<acceptance_criteria>
- `packages/db/src/migrate.ts` contains CREATE TABLE for `users` and `auth_tokens`
- Migration runs without errors when `ensureMigrated()` is called
- Dropping and recreating the database produces the tables
</acceptance_criteria>

### Task 1.3: Update package exports

<read_first>
- packages/db/src/index.ts
</read_first>

<action>
Add `User`, `NewUser`, `AuthToken`, `NewAuthToken` to the exports in `packages/db/src/index.ts`
</action>

<acceptance_criteria>
- `import { User, NewUser } from "@agent-web/db"` works
- Package builds with `pnpm --filter @agent-web/db build`
</acceptance_criteria>

## Verification Criteria

1. `pnpm --filter @agent-web/db build` succeeds
2. Deleting `data/local.db` and restarting creates both tables
3. Schema compiles without TypeScript errors

## must_haves

- `users` table exists in schema and migrations
- `auth_tokens` table exists in schema and migrations  
- Username column has UNIQUE constraint
- Package builds successfully
