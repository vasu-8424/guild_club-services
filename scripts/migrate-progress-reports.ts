import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
import path from "path";

async function applyMigration(envFile: string) {
  console.log(`\n======================================================`);
  console.log(`Running progress reports migration for ${envFile}...`);
  console.log(`======================================================`);

  dotenv.config({ path: path.resolve(process.cwd(), envFile), override: true });
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    console.error(`No DATABASE_URL found in ${envFile}`);
    return;
  }

  const sql = neon(url);

  console.log("1. Creating enum types if not exists...");
  try {
    await sql.query(`
      DO $$ BEGIN
        CREATE TYPE report_type AS ENUM ('update', 'final');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log("✓ report_type enum ready");
  } catch (err: any) {
    console.error(`Error creating report_type enum: ${err.message}`);
  }

  try {
    await sql.query(`
      DO $$ BEGIN
        CREATE TYPE report_status AS ENUM ('draft', 'submitted');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log("✓ report_status enum ready");
  } catch (err: any) {
    console.error(`Error creating report_status enum: ${err.message}`);
  }

  console.log("2. Creating progress_reports table...");
  try {
    await sql.query(`
      CREATE TABLE IF NOT EXISTS progress_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
        author_id UUID NOT NULL REFERENCES users(id),
        report_type report_type NOT NULL,
        status report_status NOT NULL DEFAULT 'draft',
        report_date DATE NOT NULL,
        current_condition TEXT NOT NULL,
        progress_text TEXT NOT NULL,
        treatment_plan TEXT,
        remarks TEXT,
        submitted_at TIMESTAMP WITH TIME ZONE,
        locked_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `);
    console.log("✓ progress_reports table ready");

    await sql.query(`CREATE INDEX IF NOT EXISTS progress_reports_case_id_idx ON progress_reports(case_id);`);
    await sql.query(`CREATE INDEX IF NOT EXISTS progress_reports_author_id_idx ON progress_reports(author_id);`);
    await sql.query(`CREATE INDEX IF NOT EXISTS progress_reports_created_at_idx ON progress_reports(created_at);`);
    await sql.query(`CREATE UNIQUE INDEX IF NOT EXISTS progress_reports_case_unique_final_idx ON progress_reports(case_id) WHERE report_type = 'final';`);
    console.log("✓ progress_reports indexes and unique final constraint ready");
  } catch (err: any) {
    console.error(`Error creating progress_reports table: ${err.message}`);
  }

  console.log("3. Creating progress_report_versions table...");
  try {
    await sql.query(`
      CREATE TABLE IF NOT EXISTS progress_report_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id UUID NOT NULL REFERENCES progress_reports(id) ON DELETE CASCADE,
        version_no INTEGER NOT NULL,
        snapshot JSONB NOT NULL,
        edited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        editor_id UUID NOT NULL REFERENCES users(id)
      );
    `);
    console.log("✓ progress_report_versions table ready");

    await sql.query(`CREATE INDEX IF NOT EXISTS progress_report_versions_report_id_idx ON progress_report_versions(report_id);`);
    await sql.query(`CREATE UNIQUE INDEX IF NOT EXISTS progress_report_versions_report_version_idx ON progress_report_versions(report_id, version_no);`);
    console.log("✓ progress_report_versions indexes ready");
  } catch (err: any) {
    console.error(`Error creating progress_report_versions table: ${err.message}`);
  }

  console.log(`Migration for ${envFile} completed successfully.`);
}

async function main() {
  await applyMigration(".env");
  await applyMigration(".env.test");
  console.log("\nAll migrations applied successfully!");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
