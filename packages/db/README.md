<!-- generated-by: gsd-doc-writer -->

# `@agent-web/db`

Shared DB layer for Agent Web. Uses [Drizzle ORM](https://orm.drizzle.team) with [libSQL](https://github.com/tursodatabase/libsql-client-ts) — local SQLite files + [Turso](https://turso.tech) edge databases.

## Tables

Defined in [`src/schema.ts`](src/schema.ts) via Drizzle `sqliteTable`.

| Table | Description |
|---|---|
| `users` | User accounts with bcrypt-hashed passwords |
| `auth_tokens` | Bearer token auth sessions linked to users |
| `projects` | Agent workspaces scoped to user + root directory |
| `sessions` | Chat sessions, optionally scoped to project |
| `messages` | Individual chat messages (user, assistant, system) |
| `api_keys` | Per-user API provider credentials (composite PK: provider + user_id) |
| `obsidian_config` | Per-user Obsidian vault path config |
| `memories` | Key-value store for long-term agent memory |

Inferred TS types (`Project`, `Session`, `Message`, ...) re-exported from `./schema`.

## Usage

```ts
import { db } from "@agent-web/db";
// or subpaths:
import { schema } from "@agent-web/db/schema";
import { getDb } from "@agent-web/db/client";
```

### Migrations

Raw SQL via libSQL client. `runMigrations()` creates all tables + indexes idempotently.

```ts
import { runMigrations } from "@agent-web/db";

await runMigrations();
```

Helper `ensureMigrated()` skips re-execution if already run in same process.

## Database URL & Connection

Client in [`src/client.ts`](src/client.ts):

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `file:./data/local.db` | SQLite file path or Turso `libsql://` URL |
| `DATABASE_AUTH_TOKEN` | (none) | Required for remote Turso DBs |

### Local SQLite

DB at `./data/local.db` relative to consumer app's working dir. No setup needed.

### Turso

```env
DATABASE_URL=libsql://your-db.turso.io
DATABASE_AUTH_TOKEN=your-turso-auth-token
```

Same `getDb()` + `runMigrations()` calls work unchanged.

## Drizzle Studio

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./packages/db/src/schema.ts",
  out: "./packages/db/drizzle",
  dialect: "sqlite",
  dbCredentials: { url: process.env.DATABASE_URL ?? "file:./data/local.db" },
});
```

```bash
npx drizzle-kit studio
```

## Build

```bash
pnpm --filter @agent-web/db build     # tsc → dist/
pnpm --filter @agent-web/db dev       # tsc --watch
```

Part of [Agent Web](https://github.com/sahin/agent-web) monorepo.
