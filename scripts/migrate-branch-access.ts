import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
import path from "path";

async function runMigrationForEnv(envFile: string) {
  console.log(`\n======================================================`);
  console.log(`Running Branch Access migration for ${envFile}...`);
  console.log(`======================================================`);

  dotenv.config({ path: path.resolve(process.cwd(), envFile), override: true });
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    console.error(`No DATABASE_URL found in ${envFile}`);
    return;
  }

  const sql = neon(url);

  console.log("1. Creating role_in_branch enum if not exists...");
  try {
    await sql.query(`
      DO $$ BEGIN
        CREATE TYPE role_in_branch AS ENUM ('admin', 'therapist');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
  } catch (err: any) {
    console.log(`Note on role_in_branch: ${err.message}`);
  }

  console.log("2. Ensuring Main Branch exists...");
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
    WHERE NOT EXISTS (SELECT 1 FROM branches WHERE is_active = true)
  `);

  console.log("3. Creating unique index on active branch name...");
  await sql.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS branches_active_name_unique_idx
    ON branches (lower(trim(name)))
    WHERE is_active = true
  `);

  console.log("4. Creating user_branches table...");
  await sql.query(`
    CREATE TABLE IF NOT EXISTS user_branches (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      role_in_branch role_in_branch NOT NULL,
      assigned_by uuid REFERENCES users(id),
      assigned_at timestamp with time zone DEFAULT now() NOT NULL,
      removed_at timestamp with time zone
    )
  `);
  await sql.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS user_branches_active_unique_idx
    ON user_branches (user_id, branch_id)
    WHERE removed_at IS NULL
  `);
  await sql.query(`
    CREATE INDEX IF NOT EXISTS user_branches_branch_id_idx ON user_branches (branch_id)
  `);
  await sql.query(`
    CREATE INDEX IF NOT EXISTS user_branches_user_id_idx ON user_branches (user_id)
  `);

  console.log("5. Ensuring default branch for all cases and NOT NULL constraint...");
  // Get primary active branch id
  const mainBranchRows = await sql.query(
    `SELECT id FROM branches WHERE is_active = true ORDER BY created_at ASC LIMIT 1`
  );
  const mainBranchId = mainBranchRows[0]?.id;
  if (!mainBranchId) {
    throw new Error("No active branch found to backfill cases!");
  }

  await sql.query(`
    UPDATE cases
    SET branch_id = $1
    WHERE branch_id IS NULL
  `, [mainBranchId]);

  try {
    await sql.query(`ALTER TABLE cases ALTER COLUMN branch_id SET NOT NULL`);
  } catch (err: any) {
    console.log(`Note setting cases.branch_id NOT NULL: ${err.message}`);
  }
  await sql.query(`
    CREATE INDEX IF NOT EXISTS cases_branch_id_idx ON cases (branch_id)
  `);

  console.log("6. Adding branch_id to sessions and backfilling from cases...");
  await sql.query(`
    ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id)
  `);
  await sql.query(`
    UPDATE sessions s
    SET branch_id = c.branch_id
    FROM cases c
    WHERE s.case_id = c.id AND s.branch_id IS NULL
  `);
  await sql.query(`
    UPDATE sessions
    SET branch_id = $1
    WHERE branch_id IS NULL
  `, [mainBranchId]);
  await sql.query(`
    CREATE INDEX IF NOT EXISTS sessions_branch_id_idx ON sessions (branch_id)
  `);

  console.log("7. Adding branch_id to admin_notes and backfilling...");
  await sql.query(`
    ALTER TABLE admin_notes
    ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id)
  `);
  await sql.query(`
    UPDATE admin_notes
    SET branch_id = $1
    WHERE branch_id IS NULL
  `, [mainBranchId]);
  await sql.query(`
    CREATE INDEX IF NOT EXISTS admin_notes_branch_id_idx ON admin_notes (branch_id)
  `);

  console.log("8. Backfilling user_branches for existing admins and therapists...");
  // 8a. Link therapists who have cases in a branch to those branches
  await sql.query(`
    INSERT INTO user_branches (user_id, branch_id, role_in_branch, assigned_at)
    SELECT DISTINCT c.current_therapist_id, c.branch_id, 'therapist'::role_in_branch, now()
    FROM cases c
    WHERE c.current_therapist_id IS NOT NULL
      AND c.branch_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM user_branches ub
        WHERE ub.user_id = c.current_therapist_id
          AND ub.branch_id = c.branch_id
          AND ub.removed_at IS NULL
      )
  `);

  // 8b. Link any remaining therapists or admins to main branch
  await sql.query(`
    INSERT INTO user_branches (user_id, branch_id, role_in_branch, assigned_at)
    SELECT u.id, $1, (CASE WHEN u.role = 'admin' THEN 'admin'::role_in_branch ELSE 'therapist'::role_in_branch END), now()
    FROM users u
    WHERE u.role IN ('admin', 'therapist')
      AND NOT EXISTS (
        SELECT 1 FROM user_branches ub
        WHERE ub.user_id = u.id AND ub.removed_at IS NULL
      )
  `, [mainBranchId]);

  console.log("9. Adding branch_id to in_app_notifications (nullable: null = account-level)...");
  await sql.query(`
    ALTER TABLE in_app_notifications
    ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE CASCADE
  `);
  await sql.query(`
    CREATE INDEX IF NOT EXISTS in_app_notifications_branch_id_idx ON in_app_notifications (branch_id)
  `);

  console.log(`✅ Branch access migration completed successfully for ${envFile}!`);
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
