import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
import path from "path";

async function runMigrationForEnv(envFile: string) {
  console.log(`\n======================================================`);
  console.log(`Running Prompt 17 Daily Board & Location migration for ${envFile}...`);
  console.log(`======================================================`);

  dotenv.config({ path: path.resolve(process.cwd(), envFile), override: true });
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    console.error(`No DATABASE_URL found in ${envFile}`);
    return;
  }

  const sql = neon(url);

  console.log("1. Adding Prompt 17 columns to login_records...");
  await sql.query(`
    ALTER TABLE login_records
    ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS signed_in_at timestamp with time zone DEFAULT now(),
    ADD COLUMN IF NOT EXISTS sign_in_latitude text,
    ADD COLUMN IF NOT EXISTS sign_in_longitude text,
    ADD COLUMN IF NOT EXISTS sign_in_accuracy_meters integer,
    ADD COLUMN IF NOT EXISTS sign_in_location_status text DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS signed_out_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS sign_out_latitude text,
    ADD COLUMN IF NOT EXISTS sign_out_longitude text,
    ADD COLUMN IF NOT EXISTS sign_out_accuracy_meters integer,
    ADD COLUMN IF NOT EXISTS sign_out_location_status text
  `);

  // Backfill existing login_records columns
  await sql.query(`
    UPDATE login_records
    SET 
      signed_in_at = COALESCE(signed_in_at, logged_in_at, now()),
      sign_in_latitude = COALESCE(sign_in_latitude, latitude),
      sign_in_longitude = COALESCE(sign_in_longitude, longitude),
      sign_in_accuracy_meters = COALESCE(sign_in_accuracy_meters, accuracy_meters),
      sign_in_location_status = COALESCE(sign_in_location_status, location_status::text, 'pending'),
      signed_out_at = COALESCE(signed_out_at, logged_out_at)
    WHERE signed_in_at IS NULL OR sign_in_location_status IS NULL
  `);

  console.log("2. Adding Prompt 17 columns to sessions...");
  await sql.query(`
    ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS present_condition_snapshot text,
    ADD COLUMN IF NOT EXISTS signature_key text
  `);

  // Backfill signature_key from patient_signature_key if present
  await sql.query(`
    UPDATE sessions
    SET signature_key = patient_signature_key
    WHERE signature_key IS NULL AND patient_signature_key IS NOT NULL
  `);

  console.log("3. Ensuring unique index and constraint on (case_id, session_date)...");
  try {
    await sql.query(`
      ALTER TABLE sessions
      ADD CONSTRAINT sessions_case_date_unique UNIQUE (case_id, session_date)
    `);
  } catch (err: any) {
    // Already exists or duplicate rows
  }

  console.log(`✅ Prompt 17 migration completed successfully for ${envFile}!`);
}

async function run() {
  const envFiles = [".env.local", ".env", ".env.test"];
  for (const file of envFiles) {
    try {
      await runMigrationForEnv(file);
    } catch (e: any) {
      console.error(`Failed migration for ${file}:`, e.message);
    }
  }
}

run();
