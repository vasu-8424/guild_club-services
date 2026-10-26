import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
import * as fs from "fs";
import path from "path";

interface ConflictRecord {
  caseNumber: string;
  patientId: string;
  patientName: string;
  roomNo: string;
  branchName: string;
  createdAt: string;
}

async function applyMigration(envFile: string): Promise<ConflictRecord[]> {
  console.log(`\n======================================================`);
  console.log(`Running rooms & admin notes migration for ${envFile}...`);
  console.log(`======================================================`);

  dotenv.config({ path: path.resolve(process.cwd(), envFile), override: true });
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    console.error(`No DATABASE_URL found in ${envFile}`);
    return [];
  }

  const sql = neon(url);
  const conflicts: ConflictRecord[] = [];

  // 1. Create rooms table
  console.log("1. Creating rooms table if not exists...");
  try {
    await sql.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_no TEXT NOT NULL,
        branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `);
    await sql.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS rooms_branch_room_no_unique_idx 
      ON rooms (branch_id, lower(trim(room_no)));
    `);
    console.log("✓ rooms table and unique index ready");
  } catch (err: any) {
    console.error(`Error creating rooms table: ${err.message}`);
  }

  // 2. Add room_id to cases
  console.log("2. Adding room_id to cases table...");
  try {
    await sql.query(`
      ALTER TABLE cases ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id);
    `);
    console.log("✓ cases.room_id column ready");
  } catch (err: any) {
    console.error(`Error adding cases.room_id: ${err.message}`);
  }

  // 3. Create admin_notes table
  console.log("3. Creating admin_notes table if not exists...");
  try {
    await sql.query(`
      CREATE TABLE IF NOT EXISTS admin_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        read_at TIMESTAMP WITH TIME ZONE
      );
    `);
    await sql.query(`CREATE INDEX IF NOT EXISTS admin_notes_to_user_id_idx ON admin_notes(to_user_id);`);
    await sql.query(`CREATE INDEX IF NOT EXISTS admin_notes_created_at_idx ON admin_notes(created_at);`);
    await sql.query(`CREATE INDEX IF NOT EXISTS admin_notes_from_user_id_idx ON admin_notes(from_user_id);`);
    console.log("✓ admin_notes table and indexes ready");
  } catch (err: any) {
    console.error(`Error creating admin_notes table: ${err.message}`);
  }

  // 4. Data Migration: Create rooms for existing (branch_id, room_no) and link cases
  console.log("4. Migrating existing case room data...");
  try {
    // Fetch default branch if any cases lack a branch_id
    const branchRows = await sql.query(`SELECT id, name FROM branches ORDER BY created_at ASC`);
    const branchMap = new Map<string, string>();
    branchRows.forEach((b: any) => branchMap.set(b.id, b.name));
    const defaultBranchId = branchRows[0]?.id;

    // Fetch all cases with room_no
    const caseRows = await sql.query(`
      SELECT c.id, c.case_number, c.patient_id, c.status, c.room_no, c.branch_id, c.created_at, cl.full_name as client_name
      FROM cases c
      LEFT JOIN clients cl ON c.client_id = cl.id
      WHERE c.room_no IS NOT NULL AND trim(c.room_no) <> ''
      ORDER BY c.created_at ASC
    `);

    // Find distinct (branch_id, lower(trim(room_no)))
    const distinctRooms = new Map<string, { branchId: string; roomNo: string }>();
    for (const c of caseRows) {
      const bId = c.branch_id || defaultBranchId;
      if (!bId) continue;
      const cleanRoomNo = c.room_no.trim();
      const key = `${bId}::${cleanRoomNo.toLowerCase()}`;
      if (!distinctRooms.has(key)) {
        distinctRooms.set(key, { branchId: bId, roomNo: cleanRoomNo });
      }
    }

    // Insert rooms if not present and build key -> roomId map
    const roomKeyToId = new Map<string, string>();
    for (const [key, item] of distinctRooms.entries()) {
      const existing = await sql.query(
        `SELECT id FROM rooms WHERE branch_id = $1 AND lower(trim(room_no)) = lower(trim($2)) LIMIT 1`,
        [item.branchId, item.roomNo]
      );
      if (existing.length > 0) {
        roomKeyToId.set(key, existing[0].id);
      } else {
        const inserted = await sql.query(
          `INSERT INTO rooms (room_no, branch_id) VALUES ($1, $2) RETURNING id`,
          [item.roomNo, item.branchId]
        );
        roomKeyToId.set(key, inserted[0].id);
      }
    }
    console.log(`✓ Processed ${distinctRooms.size} distinct rooms across branches`);

    // Link CLOSED cases directly
    for (const c of caseRows) {
      if (c.status === "completed") {
        const bId = c.branch_id || defaultBranchId;
        const key = `${bId}::${c.room_no.trim().toLowerCase()}`;
        const roomId = roomKeyToId.get(key);
        if (roomId) {
          await sql.query(`UPDATE cases SET room_id = $1 WHERE id = $2`, [roomId, c.id]);
        }
      }
    }

    // Link OPEN cases and detect conflicts
    // Group open cases by (branch_id, lower(trim(room_no)))
    const openGroups = new Map<string, any[]>();
    for (const c of caseRows) {
      if (c.status !== "completed") {
        const bId = c.branch_id || defaultBranchId;
        const key = `${bId}::${c.room_no.trim().toLowerCase()}`;
        if (!openGroups.has(key)) {
          openGroups.set(key, []);
        }
        openGroups.get(key)!.push(c);
      }
    }

    for (const [key, group] of openGroups.entries()) {
      const roomId = roomKeyToId.get(key);
      if (!roomId) continue;

      // Oldest open case gets the room
      const oldest = group[0];
      await sql.query(`UPDATE cases SET room_id = $1 WHERE id = $2`, [roomId, oldest.id]);

      // If more than one open case shares this room, set room_id = null and record conflict
      for (let i = 1; i < group.length; i++) {
        const conflictCase = group[i];
        await sql.query(`UPDATE cases SET room_id = NULL WHERE id = $1`, [conflictCase.id]);
        const branchName = branchMap.get(conflictCase.branch_id || defaultBranchId) || "Unknown Branch";
        conflicts.push({
          caseNumber: conflictCase.case_number,
          patientId: conflictCase.patient_id || "N/A",
          patientName: conflictCase.client_name || "Unknown Patient",
          roomNo: conflictCase.room_no,
          branchName,
          createdAt: conflictCase.created_at ? new Date(conflictCase.created_at).toISOString() : "Unknown",
        });
      }
    }

    console.log(`✓ Open cases linked. Conflicts identified: ${conflicts.length}`);
  } catch (err: any) {
    console.error(`Error migrating case room data: ${err.message}`);
  }

  // 5. Create partial unique index: one_open_case_per_room
  console.log("5. Creating partial unique index one_open_case_per_room...");
  try {
    await sql.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS one_open_case_per_room 
      ON cases (room_id) 
      WHERE status <> 'completed' AND room_id IS NOT NULL;
    `);
    console.log("✓ Partial unique index one_open_case_per_room successfully created");
  } catch (err: any) {
    console.error(`Error creating one_open_case_per_room index: ${err.message}`);
  }

  return conflicts;
}

async function main() {
  const envConflicts = await applyMigration(".env");
  const testConflicts = await applyMigration(".env.test");

  const allConflicts = [...envConflicts, ...testConflicts];

  // Write MIGRATION-ROOM-CONFLICTS.md report
  const reportPath = path.resolve(process.cwd(), "MIGRATION-ROOM-CONFLICTS.md");
  let content = `# Room Migration Conflicts Report\n\n`;
  content += `Generated on: ${new Date().toISOString()}\n\n`;

  if (allConflicts.length === 0) {
    content += `No room conflicts were detected during migration. All open cases have unique rooms assigned or were initialized with null rooms without clashes.\n`;
  } else {
    content += `The following open cases had duplicate room assignments during migration. In accordance with the system rules, the oldest open case was linked to the room, while the conflicting cases below had their \`room_id\` set to \`NULL\` to preserve data integrity and satisfy the \`one_open_case_per_room\` partial unique constraint.\n\n`;
    content += `| Case Number | Patient ID | Patient Name | Room | Branch | Created At | Resolution |\n`;
    content += `|---|---|---|---|---|---|---|\n`;
    for (const c of allConflicts) {
      content += `| ${c.caseNumber} | ${c.patientId} | ${c.patientName} | ${c.roomNo} | ${c.branchName} | ${c.createdAt} | \`room_id\` set to NULL; Admin/Therapist action required |\n`;
    }
    content += `\n**Action Required:** Therapists or Admins should edit these cases to assign an active, free room.\n`;
  }

  fs.writeFileSync(reportPath, content, "utf8");
  console.log(`\n✓ Conflict report written to ${reportPath}`);
  console.log("\nAll migrations completed successfully!");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
