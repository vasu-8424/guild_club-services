import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

const migrationUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!migrationUrl) {
  // Warning will be logged if env is not yet populated
  console.warn("DATABASE_URL_UNPOOLED or DATABASE_URL is not set.");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: migrationUrl || "",
  },
  verbose: true,
  strict: true,
});
