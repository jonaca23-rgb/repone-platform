import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

/**
 * The direct Postgres connection, as the database owner.
 *
 * For BetterAuth, which owns its tables, and for scripts — NOT for application
 * reads and writes. Those go through supabase-js with the signed-in person's
 * minted token so RLS decides every one of them; policies do not apply to the
 * owner. eslint.config.mjs keeps the rest of src/ (all but src/lib/auth/auth.ts) from importing it.
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Serverless functions are short-lived and reused; a small pool per instance.
  max: 4,
});

export const db = drizzle(pool, { schema, casing: "snake_case" });
