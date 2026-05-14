import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.js";

const DEFAULT_URL = "file:./data/local.db";

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (_db) return _db;

  const url = process.env.DATABASE_URL || DEFAULT_URL;
  const authToken = process.env.DATABASE_AUTH_TOKEN;

  const client = createClient({
    url,
    ...(authToken ? { authToken } : {}),
  });

  _db = drizzle(client, { schema });
  return _db;
}

export { schema };
export * from "./schema.js";
