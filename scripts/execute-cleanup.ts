import * as dotenv from "dotenv";
dotenv.config();

import { neon } from "@neondatabase/serverless";

async function main() {
  const isConfirm = process.argv.includes("--confirm");
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const sql = neon(dbUrl);
  console.log(`\n🧹 Starting Database Cleanup (Mode: ${isConfirm ? "CONFIRMED EXECUTION" : "DRY RUN"})...\n`);

  // Confirmed real user IDs to preserve under all circumstances
  const PRESERVED_EMAILS = [
    "superadmin@guildclub.com",
    "admin@guildclub.com",
    "therapist@guildclub.com",
    "veeravasu944@gmail.com",
    "vasuunakka@gmail.com",
    "22b91a04f9@gmail.com",
  ];

  const PRESERVED_BRANCH_NAMES = [
    "Main Branch",
    "North Branch",
    "Hitec City Clinic",
  ];

  // 1. Identify mock branches (names matching automated test patterns or timestamps)
  const mockBranches = await sql`
    SELECT id, name FROM branches
    WHERE (name ILIKE '%test%' OR name ILIKE '%prompt 17%' OR name ILIKE '%closed clinic%' OR name ~ '\\d{10,}')
      AND name NOT IN ('Main Branch', 'North Branch', 'Hitec City Clinic')
  `;
  const mockBranchIds = mockBranches.map((b) => b.id);
  console.log(`Found ${mockBranchIds.length} mock branches to delete.`);

  // 2. Identify mock users
  const mockUsers = await sql`
    SELECT id, email, name FROM users
    WHERE (email LIKE '%@example.com' 
       OR email LIKE '%@test.%' 
       OR email LIKE '%test.%' 
       OR email ~ '\\d{10,}' 
       OR name ILIKE '%test%' 
       OR name ILIKE '%demo%' 
       OR name ILIKE '%mock%' 
       OR name ILIKE '%prompt17%')
      AND email NOT IN ('superadmin@guildclub.com', 'admin@guildclub.com', 'therapist@guildclub.com', 'veeravasu944@gmail.com', 'vasuunakka@gmail.com', '22b91a04f9@gmail.com')
  `;
  const mockUserIds = mockUsers.map((u) => u.id);
  console.log(`Found ${mockUserIds.length} mock users to delete.`);

  // 3. Identify mock cases
  const mockCases = await sql`
    SELECT id, case_number FROM cases
    WHERE (branch_id = ANY(${mockBranchIds}::uuid[])
       OR created_by = ANY(${mockUserIds}::uuid[])
       OR current_therapist_id = ANY(${mockUserIds}::uuid[])
       OR description ILIKE '%demo%'
       OR description ILIKE '%mock%'
       OR description ILIKE '%test%'
       OR problem ILIKE '%mock%'
       OR problem ILIKE '%demo%'
       OR problem ILIKE '%test%')
  `;
  const mockCaseIds = mockCases.map((c) => c.id);
  console.log(`Found ${mockCaseIds.length} mock cases to delete.`);

  // 4. Identify mock clients
  const mockClients = await sql`
    SELECT id, full_name FROM clients
    WHERE email LIKE '%@example.com'
       OR email LIKE '%@test.%'
       OR full_name ILIKE '%demo%'
       OR full_name ILIKE '%mock%'
       OR full_name ILIKE '%test%'
       OR phone LIKE '%0000%'
       OR phone LIKE '%9999%'
  `;
  const mockClientIds = mockClients.map((c) => c.id);
  console.log(`Found ${mockClientIds.length} mock clients to delete.`);

  if (!isConfirm) {
    console.log("\n⚠️ DRY RUN ONLY. No rows were deleted. Pass --confirm to execute deletion after user authorization.\n");
    return;
  }

  // EXECUTION PHASE (inside individual transactions in foreign key dependency order)
  console.log("\n🚀 Executing deletion in dependency order...\n");

  if (mockUserIds.length > 0) {
    const deletedNotifs = await sql`DELETE FROM in_app_notifications WHERE user_id = ANY(${mockUserIds}::uuid[]) RETURNING id`;
    console.log(`- in_app_notifications: deleted ${deletedNotifs.length}`);

    const deletedLogins = await sql`DELETE FROM login_records WHERE user_id = ANY(${mockUserIds}::uuid[]) RETURNING id`;
    console.log(`- login_records: deleted ${deletedLogins.length}`);

    const deletedEmails = await sql`DELETE FROM email_queue WHERE recipient LIKE '%@example.com' OR recipient LIKE '%@test.%' OR recipient ~ '\\d{10,}' RETURNING id`;
    console.log(`- email_queue: deleted ${deletedEmails.length}`);
  }

  if (mockCaseIds.length > 0) {
    const deletedEvents = await sql`DELETE FROM case_events WHERE case_id = ANY(${mockCaseIds}::uuid[]) RETURNING id`;
    console.log(`- case_events: deleted ${deletedEvents.length}`);

    const deletedPhotos = await sql`DELETE FROM case_photos WHERE case_id = ANY(${mockCaseIds}::uuid[]) RETURNING id`;
    console.log(`- case_photos: deleted ${deletedPhotos.length}`);

    const deletedNotes = await sql`DELETE FROM case_notes WHERE case_id = ANY(${mockCaseIds}::uuid[]) RETURNING id`;
    console.log(`- case_notes: deleted ${deletedNotes.length}`);

    const deletedReports = await sql`DELETE FROM progress_reports WHERE case_id = ANY(${mockCaseIds}::uuid[]) RETURNING id`;
    console.log(`- progress_reports: deleted ${deletedReports.length}`);

    const deletedSessions = await sql`DELETE FROM sessions WHERE case_id = ANY(${mockCaseIds}::uuid[]) RETURNING id`;
    console.log(`- sessions: deleted ${deletedSessions.length}`);

    const deletedCases = await sql`DELETE FROM cases WHERE id = ANY(${mockCaseIds}::uuid[]) RETURNING id`;
    console.log(`- cases: deleted ${deletedCases.length}`);
  }

  if (mockClientIds.length > 0) {
    const deletedClients = await sql`
      DELETE FROM clients
      WHERE id = ANY(${mockClientIds}::uuid[])
        AND id NOT IN (SELECT client_id FROM cases)
      RETURNING id
    `;
    console.log(`- clients: deleted ${deletedClients.length}`);
  }

  if (mockUserIds.length > 0) {
    const deletedRoomsAssigned = await sql`DELETE FROM therapist_room_assignments WHERE therapist_id = ANY(${mockUserIds}::uuid[]) RETURNING id`;
    console.log(`- therapist_room_assignments: deleted ${deletedRoomsAssigned.length}`);

    const deletedProfiles = await sql`DELETE FROM therapist_profiles WHERE user_id = ANY(${mockUserIds}::uuid[]) RETURNING id`;
    console.log(`- therapist_profiles: deleted ${deletedProfiles.length}`);
  }

  if (mockUserIds.length > 0 || mockBranchIds.length > 0) {
    const deletedUserBranches = await sql`
      DELETE FROM user_branches
      WHERE user_id = ANY(${mockUserIds}::uuid[]) OR branch_id = ANY(${mockBranchIds}::uuid[])
      RETURNING id
    `;
    console.log(`- user_branches: deleted ${deletedUserBranches.length}`);
  }

  if (mockBranchIds.length > 0) {
    const deletedRooms = await sql`DELETE FROM rooms WHERE branch_id = ANY(${mockBranchIds}::uuid[]) RETURNING id`;
    console.log(`- rooms: deleted ${deletedRooms.length}`);

    const deletedBranches = await sql`DELETE FROM branches WHERE id = ANY(${mockBranchIds}::uuid[]) RETURNING id`;
    console.log(`- branches: deleted ${deletedBranches.length}`);
  }

  if (mockUserIds.length > 0) {
    const deletedUsers = await sql`DELETE FROM users WHERE id = ANY(${mockUserIds}::uuid[]) RETURNING id`;
    console.log(`- users: deleted ${deletedUsers.length}`);
  }

  console.log("\n✅ Database cleanup completed successfully!");
}

main().catch(console.error);

