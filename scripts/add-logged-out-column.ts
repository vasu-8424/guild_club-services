import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
import path from "path";

async function run() {
  const envFiles = [".env.local", ".env", ".env.test"];
  for (const file of envFiles) {
    try {
      dotenv.config({ path: path.resolve(process.cwd(), file), override: true });
      const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
      if (!url) continue;

      console.log(`Connecting via ${file}...`);
      const sql = neon(url);
      await sql.query(`
        ALTER TABLE login_records 
        ADD COLUMN IF NOT EXISTS logged_out_at timestamp with time zone;
      `);
      console.log(`Successfully added logged_out_at to login_records via ${file}`);
    } catch (e: any) {
      console.error(`Error with ${file}:`, e.message);
    }
  }
}

run();
