import * as dotenv from "dotenv";
dotenv.config();

import { neon } from "@neondatabase/serverless";

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("No DATABASE_URL set");
    return;
  }

  const sql = neon(dbUrl);

  console.log("Connected to DB:", dbUrl.replace(/:[^:@]+@/, ":***@"));

  const userStats = await sql`
    SELECT 
      count(*)::int as total,
      count(CASE WHEN email LIKE '%@example.com' OR email LIKE '%@test.%' OR email LIKE '%test.%' OR email ~ '\d{10,}' OR name ILIKE '%test%' OR name ILIKE '%demo%' OR name ILIKE '%mock%' THEN 1 END)::int as mock_users,
      count(CASE WHEN email NOT LIKE '%@example.com' AND email NOT LIKE '%@test.%' AND email NOT LIKE '%test.%' AND email !~ '\d{10,}' AND name NOT ILIKE '%test%' AND name NOT ILIKE '%demo%' AND name NOT ILIKE '%mock%' THEN 1 END)::int as real_users
    FROM users
  `;
  console.log("Users:", userStats[0]);

  const clientStats = await sql`
    SELECT 
      count(*)::int as total,
      count(CASE WHEN email LIKE '%@example.com' OR email LIKE '%@test.%' OR full_name ILIKE '%demo%' OR full_name ILIKE '%mock%' OR full_name ILIKE '%test%' OR phone LIKE '%0000%' THEN 1 END)::int as mock_clients
    FROM clients
  `;
  console.log("Clients:", clientStats[0]);

  const branchStats = await sql`
    SELECT 
      count(*)::int as total,
      count(CASE WHEN name ILIKE '%test%' OR name ILIKE '%demo%' OR name ILIKE '%inactive%' OR name ~ '\d{10,}' THEN 1 END)::int as mock_branches
    FROM branches
  `;
  console.log("Branches:", branchStats[0]);

  const caseStats = await sql`
    SELECT 
      count(*)::int as total,
      count(CASE WHEN description ILIKE '%demo%' OR description ILIKE '%mock%' OR description ILIKE '%test%' OR problem ILIKE '%demo%' OR problem ILIKE '%mock%' OR problem ILIKE '%test%' THEN 1 END)::int as mock_cases
    FROM cases
  `;
  console.log("Cases:", caseStats[0]);

  const sessionStats = await sql`
    SELECT 
      count(*)::int as total,
      count(CASE WHEN notes ILIKE '%test%' OR notes ILIKE '%demo%' OR notes ILIKE '%mock%' OR work_done ILIKE '%test%' OR work_done ILIKE '%demo%' THEN 1 END)::int as mock_sessions
    FROM sessions
  `;
  console.log("Sessions:", sessionStats[0]);

  const notesStats = await sql`
    SELECT 
      count(*)::int as total,
      count(CASE WHEN note ILIKE '%test%' OR note ILIKE '%demo%' OR note ILIKE '%canary%' THEN 1 END)::int as mock_notes
    FROM case_notes
  `;
  console.log("Case Notes:", notesStats[0]);

  const eventsStats = await sql`
    SELECT count(*)::int as total FROM case_events
  `;
  console.log("Case Events:", eventsStats[0]);

  const notifStats = await sql`
    SELECT count(*)::int as total FROM in_app_notifications
  `;
  console.log("In-App Notifications:", notifStats[0]);

  const emailStats = await sql`
    SELECT count(*)::int as total FROM email_queue
  `;
  console.log("Email Queue:", emailStats[0]);

  const loginStats = await sql`
    SELECT count(*)::int as total FROM login_records
  `;
  console.log("Login Records:", loginStats[0]);

  const userBranchesStats = await sql`
    SELECT count(*)::int as total FROM user_branches
  `;
  console.log("User Branches:", userBranchesStats[0]);

  const roomsStats = await sql`
    SELECT count(*)::int as total FROM rooms
  `;
  console.log("Rooms:", roomsStats[0]);

  console.log("\n--- Real/Production Candidates (Users) ---");
  const realUsers = await sql`
    SELECT id, email, name, role, is_active, created_at
    FROM users
    WHERE email NOT LIKE '%@example.com' 
      AND email NOT LIKE '%@test.%' 
      AND email NOT LIKE '%test.%'
      AND email !~ '\d{10,}'
      AND name NOT ILIKE '%test%'
      AND name NOT ILIKE '%demo%'
      AND name NOT ILIKE '%mock%'
    ORDER BY created_at ASC
  `;
  console.table(realUsers);

  console.log("\n--- Active Branches ---");
  const branches = await sql`
    SELECT id, name, is_active, created_at
    FROM branches
    ORDER BY created_at ASC
  `;
  console.table(branches);
}

main().catch(console.error);
