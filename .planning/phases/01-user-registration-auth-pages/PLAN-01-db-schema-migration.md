---
id: 01-user-registration-auth-pages-plan1
phase: 1
wave: 1
depends_on: []
files_modified:
  - packages/db/src/schema.ts
  - packages/db/src/migrate.ts
autonomous: true
requirements:
  - DB-01
  - AUTH-07
---

## Objective

Add `users` table to the Drizzle schema and raw-SQL migration, providing the persistence foundation for all auth flows.

---

## Tasks

### Task 1: Add `users` table definition to `packages/db/src/schema.ts`

<read_first>
- `packages/db/src/schema.ts` — existing `sqliteTable` pattern, column naming, type exports
</read_first>

<action>
1. Import nothing new — all needed imports (`sqliteTable`, `text`, `integer`) are already present.
2. Add the following table definition **after the `apiKeys` table and before the type exports**:

```typescript
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
```

3. Add type exports **after the table definition**:

```typescript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

4. Verify the file compiles: run `pnpm --filter @agent-web/db build`.
</action>

<acceptance_criteria>
- `packages/db/src/schema.ts` contains a `users` table with columns: `id` (text PK), `username` (text, unique, not null), `passwordHash` (text, not null), `createdAt`, `updatedAt` (integers, not null)
- `User` and `NewUser` types are exported
- `pnpm --filter @agent-web/db build` succeeds
</acceptance_criteria>

---

### Task 2: Add `CREATE TABLE users` migration to `packages/db/src/migrate.ts`

<read_first>
- `packages/db/src/migrate.ts` — existing `CREATE_*` SQL constant pattern, `runMigrations()` execution order
</read_first>

<action>
1. Add the migration SQL constant near the other `CREATE_*` constants:

```typescript
const CREATE_USERS = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;
```

2. Add a username lookup index:

```typescript
const CREATE_INDEX_USERS_USERNAME = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
`;
```

3. In `runMigrations()`, execute the new migration **after `CREATE_API_KEYS`**:

```typescript
await client.execute(CREATE_USERS);
await client.execute(CREATE_INDEX_USERS_USERNAME);
```

4. Verify the migration runs: start the dev server (`pnpm dev`) and check for errors in the terminal output. The `ensureMigrated()` call in `lib/db.ts` runs migrations on every startup.
</action>

<acceptance_criteria>
- `packages/db/src/migrate.ts` contains `CREATE_USERS` SQL with all 5 columns and `UNIQUE` on `username`
- `CREATE_INDEX_USERS_USERNAME` creates a unique index on `users(username)`
- Both are executed in `runMigrations()` after existing migrations
- Dev server starts without migration errors
</acceptance_criteria>

---

### Task 3: Verify package builds and exports

<read_first>
- `packages/db/src/index.ts` — re-exports (uses `export * from`, so new exports are automatic)
</read_first>

<action>
1. Confirm `packages/db/src/index.ts` uses `export * from "./schema.js"` — no change needed.
2. Build the package:

```bash
cd /path/to/agent-web
pnpm --filter @agent-web/db build
```

3. Confirm no TypeScript errors.
</action>

<acceptance_criteria>
- `pnpm --filter @agent-web/db build` exits 0
- `User` and `NewUser` types are importable from `@agent-web/db`
</acceptance_criteria>

---

## Verification Criteria

1. `packages/db/src/schema.ts` has `users` table with all 5 columns + `User`/`NewUser` type exports
2. `packages/db/src/migrate.ts` has `CREATE_USERS` + index, both run in `runMigrations()`
3. `pnpm --filter @agent-web/db build` passes
4. Dev server starts without errors (migrations run on startup)

## Must Haves

- `users` table with `username TEXT NOT NULL UNIQUE` — DB-level uniqueness guard
- `password_hash` column (never store plaintext)
- Matching Drizzle `User`/`NewUser` types
- Migration uses `CREATE TABLE IF NOT EXISTS` for idempotent re-runs
- Migration runs automatically via existing `ensureMigrated()` mechanism
