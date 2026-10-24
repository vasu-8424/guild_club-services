import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString && process.env.NODE_ENV !== "production") {
  console.warn("DATABASE_URL is not set in environment variables.");
}

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
  db: ReturnType<typeof drizzle> | undefined;
};

// Neon connection pool supporting full PostgreSQL transactions and queries
export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: connectionString || "",
  });

if (!globalForDb.pool) {
  pool.on("error", (err: unknown) => {
    // Log background disconnects to prevent uncaughtException from crashing the process
    console.warn("Neon pool background socket event:", (err as Error)?.message || err);
  });
}

if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = globalForDb.db ?? drizzle(pool, { schema });
if (process.env.NODE_ENV !== "production") globalForDb.db = db;

export type DatabaseInstance = typeof db;
export * from "./schema";
