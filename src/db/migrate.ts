import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config();

async function runMigrations() {
  const connectionString =
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

  if (!connectionString) {
    console.error(
      "ERROR: Neither DATABASE_URL_UNPOOLED nor DATABASE_URL is set in environment."
    );
    process.exit(1);
  }

  console.log("Connecting with unpooled database connection for migrations...");
  const sql = neon(connectionString);
  const db = drizzle(sql);

  const migrationsFolder = path.resolve(process.cwd(), "src/db/migrations");
  console.log(`Applying migrations from: ${migrationsFolder}`);

  try {
    await migrate(db, { migrationsFolder });
    console.log("Migrations applied successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runMigrations();
