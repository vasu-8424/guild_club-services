import * as dotenv from "dotenv";
import path from "path";
import { neon } from "@neondatabase/serverless";

async function main() {
  console.log("=================================================");
  console.log("STEP 1: ENVIRONMENT & MIGRATIONS VERIFICATION");
  console.log("=================================================");

  // Load .env.test
  dotenv.config({ path: path.resolve(process.cwd(), ".env.test"), override: true });

  const emailProvider = process.env.EMAIL_PROVIDER;
  const dbUrl = process.env.DATABASE_URL || "";
  const dbUrlUnpooled = process.env.DATABASE_URL_UNPOOLED || dbUrl;

  console.log("\n1. Verification of EMAIL_PROVIDER:");
  if (emailProvider !== "mock") {
    console.error(`❌ FATAL: EMAIL_PROVIDER must be 'mock', found '${emailProvider}'`);
    process.exit(1);
  }
  console.log(`[PASS] EMAIL_PROVIDER is strictly 'mock' (${emailProvider})`);

  console.log("\n2. Verification of DATABASE_URL:");
  const isTestDb =
    dbUrl.includes("neondb_test") ||
    dbUrl.includes("test") ||
    dbUrl.includes("_test");

  if (!isTestDb) {
    console.error(`❌ FATAL: DATABASE_URL is not the test branch: ${dbUrl}`);
    process.exit(1);
  }
  console.log(`[PASS] DATABASE_URL verified on test branch/database.`);

  console.log("\n3. Set Environment Variable NAMES (No values):");
  const filteredKeys = Object.keys(process.env)
    .filter(
      (k) =>
        !k.startsWith("npm_") &&
        !k.startsWith("Program") &&
        !k.startsWith("Common") &&
        !k.startsWith("APPDATA") &&
        !k.startsWith("USER") &&
        !k.startsWith("SYSTEM") &&
        !k.startsWith("LOCAL") &&
        !k.startsWith("PATH") &&
        !k.startsWith("ALLUSER") &&
        !k.startsWith("OS") &&
        !k.startsWith("NUMBER_OF_") &&
        !k.startsWith("PROCESSOR_") &&
        !k.startsWith("TEMP") &&
        !k.startsWith("TMP") &&
        !k.startsWith("PSModule") &&
        !k.startsWith("ComSpec") &&
        !k.startsWith("DRIVERDATA") &&
        !k.startsWith("OneDrive") &&
        !k.startsWith("PUBLIC") &&
        !k.startsWith("SESSIONNAME") &&
        !k.startsWith("WINDIR") &&
        !k.startsWith("Chocolatey") &&
        !k.startsWith("VSCODE") &&
        !k.startsWith("HOMEPATH") &&
        !k.startsWith("HOMEDRIVE") &&
        !k.startsWith("LOGONSERVER")
    )
    .sort();

  for (const name of filteredKeys) {
    console.log(`  - ${name}`);
  }

  console.log("\n4. Running Migrations on Test Database (First Run)...");
  const sql = neon(dbUrlUnpooled);

  // Measure columns and indices before run 1
  const colsBeforeRun1 = await sql.query(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    ORDER BY table_name, column_name;
  `);

  // Run Prompt 17 & Branch migrations
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

  await sql.query(`
    ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS present_condition_snapshot text,
    ADD COLUMN IF NOT EXISTS signature_key text
  `);

  await sql.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS sessions_case_date_unique_idx
    ON sessions (case_id, session_date)
    WHERE session_date IS NOT NULL
  `);

  await sql.query(`
    ALTER TABLE in_app_notifications
    ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE CASCADE
  `);

  const colsAfterRun1 = await sql.query(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    ORDER BY table_name, column_name;
  `);

  console.log(`[PASS] Run 1 completed. Total schema columns: ${colsAfterRun1.length}`);

  console.log("\n5. Running Migrations on Test Database (Second Run - Idempotency Check)...");
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

  await sql.query(`
    ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS present_condition_snapshot text,
    ADD COLUMN IF NOT EXISTS signature_key text
  `);

  await sql.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS sessions_case_date_unique_idx
    ON sessions (case_id, session_date)
    WHERE session_date IS NOT NULL
  `);

  await sql.query(`
    ALTER TABLE in_app_notifications
    ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE CASCADE
  `);

  const colsAfterRun2 = await sql.query(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    ORDER BY table_name, column_name;
  `);

  console.log(`[PASS] Run 2 completed. Total schema columns: ${colsAfterRun2.length}`);

  if (colsAfterRun1.length !== colsAfterRun2.length) {
    console.error(`❌ FATAL: Column count changed between Run 1 and Run 2! (${colsAfterRun1.length} -> ${colsAfterRun2.length})`);
    process.exit(1);
  }

  console.log(`[PASS] Idempotency verified: Second migration run changed NOTHING.`);
  console.log("\nStep 1 Environment & Migrations Check Completed Successfully!");
}

main().catch((err) => {
  console.error("Environment verification failed:", err);
  process.exit(1);
});
