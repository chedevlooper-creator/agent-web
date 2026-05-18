<!-- generated-by: gsd-doc-writer -->

# `@agent-web/db`

Shared database layer for Agent Web. Uses [Drizzle ORM](https://orm.drizzle.team) with [libSQL](https://github.com/tursodatabase/libsql-client-ts) to support both local SQLite files and [Turso](https://turso.tech) edge databases.

## Tables

Defined in [`src/schema.ts`](src/schema.ts) using Drizzle's `sqliteTable`.

| Table | Description |
|---|---|
| `users` | User accounts with bcrypt-hashed passwords |
| `auth_tokens` | Bearer token authentication sessions linked to users |
| `projects` | Agent workspaces scoped to a user and root directory |
| `sessions` | Chat sessions optionally scoped to a project |
| `messages` | Individual chat messages (user, assistant, system roles) |
| `api_keys` | Per-user API provider credentials (composite PK on provider + user_id) |
| `obsidian_config` | Per-user Obsidian vault path configuration |
| `memories` | Simple key-value store for long-term agent memory |

Inferred TypeScript types (`Project`, `Session`, `Message`, ...) are re-exported from `./schema`.

## Usage

```ts
import { db } from "@agent-web/db";
// or import subpaths:
import { schema } from "@agent-web/db/schema";
import { getDb } from "@agent-web/db/client";
```

### Migrations

Migrations are run via raw SQL through the libSQL client. The `runMigrations()` function creates all tables and indexes idempotently.

```ts
import { runMigrations } from "@agent-web/db";

await runMigrations();
```

A convenience helper `ensureMigrated()` skips re-execution if already run in the same process.

## Database URL & Connection

The client is created in [`src/client.ts`](src/client.ts):

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `file:./data/local.db` | SQLite file path or Turso `libsql://` URL |
| `DATABASE_AUTH_TOKEN` | (none) | Required for remote Turso databases |

### Local SQLite

By default the database is stored at `./data/local.db` relative to the consuming application's working directory. No additional setup needed.

### Turso

Set the following environment variables:

```env
DATABASE_URL=libsql://your-db.turso.io
DATABASE_AUTH_TOKEN=your-turso-auth-token
```

The same `getDb()` and `runMigrations()` calls work with no code changes.

## Drizzle Studio

To inspect data with [Drizzle Studio](https://orm.drizzle.team/drizzle-studio/overview), create a `drizzle.config.ts` at the project root (or this package root):

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./packages/db/src/schema.ts",
  out: "./packages/db/drizzle",
  dialect: "sqlite",
  dbCredentials: { url: process.env.DATABASE_URL ?? "file:./data/local.db" },
});
```

Then run:

```bash
npx drizzle-kit studio
```

## Build

```bash
pnpm --filter @agent-web/db build     # tsc → dist/
pnpm --filter @agent-web/db dev       # tsc --watch
```

Part of the [Agent Web](https://github.com/sahin/agent-web) monorepo.
