import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // Reuse the client across dev hot-reloads and serverless invocations.
  // eslint-disable-next-line no-var
  var __fdSql: ReturnType<typeof postgres> | undefined;
}

// postgres.js opens no socket until the first query, so an unset DATABASE_URL
// must not throw here - `next build` imports route modules with no env. The
// placeholder makes any real query fail with a clear connection error, and
// /api/health reports "unconfigured" before ever querying.
const url =
  process.env.DATABASE_URL ??
  "postgres://unconfigured:unconfigured@localhost:5432/unconfigured";

// `prepare: false` keeps this compatible with transaction-mode poolers
// (Neon/Supabase/pgbouncer) that serverless deploys typically sit behind.
const sql = globalThis.__fdSql ?? postgres(url, { prepare: false, max: 5 });
globalThis.__fdSql = sql;

export const db = drizzle(sql, { schema });
export { schema };
