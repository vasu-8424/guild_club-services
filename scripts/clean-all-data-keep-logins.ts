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
  console.log(`\n🧹 Database Cleanup: DELETE ALL DATA, KEEP LOGINS (Mode: ${isConfirm ? "CONFIRMED EXECUTION" : "DRY RUN"})\n`);

  // Count current rows in all relevant tables
  const [
    usersCount,
    clientsCount,
    casesCount,
    sessionsCount,
    notesCount,
    eventsCount,
    notifsCount,
    emailQueueCount,
    loginRecordsCount,
    branchesCount,
    roomsCount,
    userBranchesCount,
    therapistProfilesCount,
  ] = await Promise.all([
    sql`SELECT count(*)::int AS count FROM users`,
    sql`SELECT count(*)::int AS count FROM clients`,
    sql`SELECT count(*)::int AS count FROM cases`,
    sql`SELECT count(*)::int AS count FROM sessions`,
    sql`SELECT count(*)::int AS count FROM case_notes`,
    sql`SELECT count(*)::int AS count FROM case_events`,
    sql`SELECT count(*)::int AS count FROM in_app_notifications`,
    sql`SELECT count(*)::int AS count FROM email_queue`,
    sql`SELECT count(*)::int AS count FROM login_records`,
    sql`SELECT count(*)::int AS count FROM branches`,
    sql`SELECT count(*)::int AS count FROM rooms`,
    sql`SELECT count(*)::int AS count FROM user_branches`,
    sql`SELECT count(*)::int AS count FROM therapist_profiles`,
  ]);

  console.log("Current Database Status:");
  console.log(`- users (LOGINS): ${usersCount[0].count} (WILL BE PRESERVED)`);
  console.log(`- therapist_profiles: ${therapistProfilesCount[0].count} (WILL BE PRESERVED)`);
  console.log(`- user_branches: ${userBranchesCount[0].count}`);
  console.log(`- branches: ${branchesCount[0].count}`);
  console.log(`- rooms: ${roomsCount[0].count}`);
  console.log(`- clients: ${clientsCount[0].count} (TO BE DELETED)`);
  console.log(`- cases: ${casesCount[0].count} (TO BE DELETED)`);
  console.log(`- sessions: ${sessionsCount[0].count} (TO BE DELETED)`);
  console.log(`- case_notes: ${notesCount[0].count} (TO BE DELETED)`);
  console.log(`- case_events: ${eventsCount[0].count} (TO BE DELETED)`);
  console.log(`- in_app_notifications: ${notifsCount[0].count} (TO BE DELETED)`);
  console.log(`- email_queue: ${emailQueueCount[0].count} (TO BE DELETED)`);
  console.log(`- login_records: ${loginRecordsCount[0].count} (TO BE DELETED)`);

  // Identify real branches (names without test patterns or timestamps)
  const realBranches = await sql`
    SELECT id, name FROM branches
    WHERE name NOT ILIKE '%test%'
      AND name NOT ILIKE '%prompt%'
      AND name !~ '\\d{10,}'
    ORDER BY created_at ASC
  `;
  const realBranchIds = realBranches.map(b => b.id);
  console.log(`\nPreserved Primary Branches (${realBranches.length}):`, realBranches.map(b => b.name).join(", "));

  const mockBranches = await sql`
    SELECT id, name FROM branches
    WHERE id != ALL(${realBranchIds}::uuid[])
  `;
  console.log(`Mock branches to prune: ${mockBranches.length}`);

  if (!isConfirm) {
    console.log("\n⚠️ DRY RUN ONLY. No data deleted. Pass --confirm to execute.\n");
    return;
  }

  console.log("\n🚀 Executing clean wipe of all operational data while preserving all logins...\n");

  // 1. Delete dependent child records of cases
  const delNotifs = await sql`DELETE FROM in_app_notifications RETURNING id`;
  console.log(`✔ Deleted in_app_notifications: ${delNotifs.length}`);

  const delEmailQueue = await sql`DELETE FROM email_queue RETURNING id`;
  console.log(`✔ Deleted email_queue: ${delEmailQueue.length}`);

  const delLoginRecords = await sql`DELETE FROM login_records RETURNING id`;
  console.log(`✔ Deleted login_records: ${delLoginRecords.length}`);

  const delCaseEvents = await sql`DELETE FROM case_events RETURNING id`;
  console.log(`✔ Deleted case_events: ${delCaseEvents.length}`);

  const delCasePhotos = await sql`DELETE FROM case_photos RETURNING id`;
  console.log(`✔ Deleted case_photos: ${delCasePhotos.length}`);

  const delCaseNotes = await sql`DELETE FROM case_notes RETURNING id`;
  console.log(`✔ Deleted case_notes: ${delCaseNotes.length}`);

  const delProgressReports = await sql`DELETE FROM progress_reports RETURNING id`;
  console.log(`✔ Deleted progress_reports: ${delProgressReports.length}`);

  const delSessions = await sql`DELETE FROM sessions RETURNING id`;
  console.log(`✔ Deleted sessions: ${delSessions.length}`);

  const delRoomAssignments = await sql`DELETE FROM therapist_room_assignments RETURNING id`;
  console.log(`✔ Deleted therapist_room_assignments: ${delRoomAssignments.length}`);

  // 2. Delete cases
  const delCases = await sql`DELETE FROM cases RETURNING id`;
  console.log(`✔ Deleted cases: ${delCases.length}`);

  // 3. Delete clients
  const delClients = await sql`DELETE FROM clients RETURNING id`;
  console.log(`✔ Deleted clients: ${delClients.length}`);

  // 4. Clean mock branches & their rooms
  if (mockBranches.length > 0) {
    const mockIds = mockBranches.map(b => b.id);
    const delRooms = await sql`DELETE FROM rooms WHERE branch_id = ANY(${mockIds}::uuid[]) RETURNING id`;
    console.log(`✔ Deleted rooms in mock branches: ${delRooms.length}`);

    const delUserBranches = await sql`DELETE FROM user_branches WHERE branch_id = ANY(${mockIds}::uuid[]) RETURNING id`;
    console.log(`✔ Deleted user_branches in mock branches: ${delUserBranches.length}`);

    const delBranches = await sql`DELETE FROM branches WHERE id = ANY(${mockIds}::uuid[]) RETURNING id`;
    console.log(`✔ Deleted mock branches: ${delBranches.length}`);
  }

  // 5. Verify all users/logins are untouched
  const finalUsers = await sql`SELECT count(*)::int AS count FROM users`;
  const finalBranches = await sql`SELECT count(*)::int AS count FROM branches`;
  const finalCases = await sql`SELECT count(*)::int AS count FROM cases`;
  const finalClients = await sql`SELECT count(*)::int AS count FROM clients`;

  console.log("\n=================================");
  console.log("✨ CLEANUP COMPLETED SUCCESSFULLY");
  console.log("=================================");
  console.log(`- Users / Logins preserved: ${finalUsers[0].count}`);
  console.log(`- Branches preserved: ${finalBranches[0].count}`);
  console.log(`- Cases remaining: ${finalCases[0].count}`);
  console.log(`- Clients remaining: ${finalClients[0].count}`);
}

main().catch(err => {
  console.error("Cleanup error:", err);
  process.exit(1);
});
