import * as dotenv from "dotenv";
dotenv.config();

import { neon } from "@neondatabase/serverless";

async function main() {
  const isConfirm = process.argv.includes("--confirm");
  const sql = neon(process.env.DATABASE_URL!);

  console.log(`\n🧹 Purging all users EXCEPT core Admin, Super Admin, and Therapist logins (Mode: ${isConfirm ? "CONFIRMED EXECUTION" : "DRY RUN"})\n`);

  // Preserved Accounts
  const PRESERVED_EMAILS = [
    "superadmin@guildclub.com",
    "admin@guildclub.com",
    "therapist@guildclub.com",
    "veeravasu944@gmail.com",
    "vasuunakka@gmail.com",
    "22b91a04f9@gmail.com",
  ];

  // 1. Fetch users to keep
  const keepUsers = await sql`
    SELECT id, email, name, role
    FROM users
    WHERE email = ANY(${PRESERVED_EMAILS})
    ORDER BY created_at ASC
  `;

  console.log("Preserved User Logins:");
  console.table(keepUsers);

  const keepUserIds = keepUsers.map(u => u.id);

  // 2. Fetch users to delete
  const usersToDelete = await sql`
    SELECT id, email, name, role
    FROM users
    WHERE id != ALL(${keepUserIds}::uuid[])
  `;

  console.log(`\nFound ${usersToDelete.length} users to delete.\n`);

  if (!isConfirm) {
    console.log("⚠️ DRY RUN ONLY. Run with --confirm to execute deletion.");
    return;
  }

  const deleteIds = usersToDelete.map(u => u.id);

  if (deleteIds.length > 0) {
    // A. Delete any therapist_profiles for users to delete
    const delProfiles = await sql`
      DELETE FROM therapist_profiles
      WHERE user_id = ANY(${deleteIds}::uuid[])
      RETURNING user_id
    `;
    console.log(`✔ Deleted therapist_profiles: ${delProfiles.length}`);

    // B. Delete user_branches for users to delete
    const delUB = await sql`
      DELETE FROM user_branches
      WHERE user_id = ANY(${deleteIds}::uuid[])
      RETURNING id
    `;
    console.log(`✔ Deleted user_branches: ${delUB.length}`);

    // C. Delete the users
    const delUsers = await sql`
      DELETE FROM users
      WHERE id = ANY(${deleteIds}::uuid[])
      RETURNING id
    `;
    console.log(`✔ Deleted users: ${delUsers.length}`);
  }

  // 3. Make sure all preserved admins and therapists have active branch access to all 3 main branches
  const branches = await sql`SELECT id, name FROM branches ORDER BY name ASC`;
  console.log(`\nPreserved Branches (${branches.length}):`, branches.map(b => b.name).join(", "));

  for (const user of keepUsers) {
    for (const branch of branches) {
      const existing = await sql`
        SELECT id FROM user_branches
        WHERE user_id = ${user.id} AND branch_id = ${branch.id} AND removed_at IS NULL
      `;
      if (existing.length === 0) {
        await sql`
          INSERT INTO user_branches (id, user_id, branch_id, role_in_branch)
          VALUES (gen_random_uuid(), ${user.id}, ${branch.id}, ${user.role === 'super_admin' ? 'admin' : user.role})
        `;
        console.log(`+ Assigned ${user.email} (${user.role}) to branch: ${branch.name}`);
      }
    }
  }

  // 4. Final verify
  const remainingUsers = await sql`SELECT id, email, name, role FROM users ORDER BY created_at ASC`;
  console.log("\n=================================");
  console.log("✨ ALL OTHER DATA AND USERS DELETED");
  console.log("=================================");
  console.log(`Remaining Users in Database (${remainingUsers.length}):`);
  console.table(remainingUsers);
}

main().catch(console.error);
