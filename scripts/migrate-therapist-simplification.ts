import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
import path from "path";

async function applyMigration(envFile: string) {
  console.log(`\n======================================================`);
  console.log(`Running therapist simplification migration for ${envFile}...`);
  console.log(`======================================================`);

  dotenv.config({ path: path.resolve(process.cwd(), envFile), override: true });
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    console.error(`No DATABASE_URL found in ${envFile}`);
    return;
  }

  const sql = neon(url);

  console.log("1. Updating enum types...");
  try {
    await sql.query(`ALTER TYPE case_status ADD VALUE IF NOT EXISTS 'active'`);
  } catch (err: any) {
    console.log(`Note on case_status: ${err.message}`);
  }

  try {
    await sql.query(`ALTER TYPE case_outcome ADD VALUE IF NOT EXISTS 'improved'`);
  } catch (err: any) {
    console.log(`Note on case_outcome improved: ${err.message}`);
  }
  try {
    await sql.query(`ALTER TYPE case_outcome ADD VALUE IF NOT EXISTS 'partially_improved'`);
  } catch (err: any) {
    console.log(`Note on case_outcome partially_improved: ${err.message}`);
  }
  try {
    await sql.query(`ALTER TYPE case_outcome ADD VALUE IF NOT EXISTS 'no_change'`);
  } catch (err: any) {
    console.log(`Note on case_outcome no_change: ${err.message}`);
  }

  try {
    await sql.query(`
      DO $$ BEGIN
        CREATE TYPE service_type AS ENUM ('physiotherapy', 'swallow_therapy', 'vitalstim_therapy');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
  } catch (err: any) {
    console.log(`Note on service_type: ${err.message}`);
  }

  try {
    await sql.query(`
      DO $$ BEGIN
        CREATE TYPE login_location_status AS ENUM ('captured', 'denied', 'unavailable');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
  } catch (err: any) {
    console.log(`Note on login_location_status: ${err.message}`);
  }

  try {
    await sql.query(`
      DO $$ BEGIN
        CREATE TYPE photo_kind AS ENUM ('joining', 'present');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
  } catch (err: any) {
    console.log(`Note on photo_kind: ${err.message}`);
  }

  console.log("2. Creating sequence for Patient IDs...");
  await sql.query(`CREATE SEQUENCE IF NOT EXISTS patient_id_seq START WITH 1 INCREMENT BY 1;`);

  console.log("3. Creating branches table & seeding default...");
  await sql.query(`
    CREATE TABLE IF NOT EXISTS branches (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      is_active boolean DEFAULT true NOT NULL,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await sql.query(`
    INSERT INTO branches (name, is_active)
    SELECT 'Main Branch', true
    WHERE NOT EXISTS (SELECT 1 FROM branches)
  `);

  console.log("4. Creating login_records table...");
  await sql.query(`
    CREATE TABLE IF NOT EXISTS login_records (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      logged_in_at timestamp with time zone DEFAULT now() NOT NULL,
      latitude text,
      longitude text,
      accuracy_meters integer,
      location_status login_location_status DEFAULT 'unavailable' NOT NULL,
      ip_address text,
      user_agent text,
      logged_out_at timestamp with time zone,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await sql.query(`CREATE INDEX IF NOT EXISTS login_records_user_id_idx ON login_records (user_id)`);
  await sql.query(`CREATE INDEX IF NOT EXISTS login_records_logged_in_at_idx ON login_records (logged_in_at)`);

  console.log("5. Creating case_photos table...");
  await sql.query(`
    CREATE TABLE IF NOT EXISTS case_photos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      kind photo_kind NOT NULL,
      file_key text NOT NULL,
      taken_at timestamp with time zone DEFAULT now() NOT NULL,
      uploaded_by uuid NOT NULL REFERENCES users(id),
      created_at timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await sql.query(`CREATE INDEX IF NOT EXISTS case_photos_case_id_idx ON case_photos (case_id)`);
  await sql.query(`CREATE INDEX IF NOT EXISTS case_photos_kind_idx ON case_photos (kind)`);

  console.log("6. Adding columns to cases...");
  await sql.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS patient_id text UNIQUE`);
  await sql.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS service text`);
  await sql.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS problem text`);
  await sql.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS present_condition text`);
  await sql.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS present_condition_at_close text`);
  await sql.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS closing_notes text`);
  await sql.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS start_date date`);
  await sql.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS room_no text`);
  await sql.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id)`);
  await sql.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS sex text`);
  await sql.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS consent_obtained boolean DEFAULT true`);

  console.log("7. Adding columns to sessions...");
  await sql.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_date date`);
  await sql.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS recorded_at timestamp with time zone`);
  await sql.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS photo_key text`);

  try {
    await sql.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS sessions_case_date_unique_idx 
      ON sessions (case_id, session_date) 
      WHERE session_date IS NOT NULL
    `);
  } catch (err: any) {
    console.log(`Note on sessions unique idx: ${err.message}`);
  }

  console.log(`✅ Migration complete for ${envFile}!`);
}

async function main() {
  await applyMigration(".env");
  await applyMigration(".env.test");
}

main().catch(console.error);
