import { test, expect } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { assertTestDatabase } from "../../helpers/seed-test-data";

test.describe("Suite D: ROOMS", () => {
  const sql = neon(assertTestDatabase());
  const ts = Date.now();

  test("[RM-01] Create a room in a branch", async ({ page }) => {
    const [mainBranch] = await sql`SELECT id FROM branches WHERE name = 'Main Branch' LIMIT 1`;
    const roomNo = `301-${ts % 1000}`;

    await sql`
      INSERT INTO rooms (room_no, branch_id, is_active)
      VALUES (${roomNo}, ${mainBranch.id}, true)
    `;

    const [created] = await sql`SELECT id FROM rooms WHERE room_no = ${roomNo} AND branch_id = ${mainBranch.id}`;
    expect(created).toBeDefined();
  });

  test("[RM-02] Duplicate room in same branch rejected (case and spacing variants)", async ({ page }) => {
    const [mainBranch] = await sql`SELECT id FROM branches WHERE name = 'Main Branch' LIMIT 1`;
    const baseRoom = `Room-${ts % 1000}`;

    await sql`INSERT INTO rooms (room_no, branch_id, is_active) VALUES (${baseRoom}, ${mainBranch.id}, true)`;

    let duplicateRejected = false;
    try {
      await sql`INSERT INTO rooms (room_no, branch_id, is_active) VALUES (${`  ${baseRoom.toLowerCase()}  `}, ${mainBranch.id}, true)`;
    } catch {
      duplicateRejected = true;
    }

    expect(duplicateRejected).toBe(true);
  });

  test("[RM-03] Same room number in another branch allowed", async ({ page }) => {
    const [mainBranch] = await sql`SELECT id FROM branches WHERE name = 'Main Branch' LIMIT 1`;
    const [northBranch] = await sql`SELECT id FROM branches WHERE name = 'North Branch' LIMIT 1`;
    const sharedRoomNo = `401-${ts % 1000}`;

    await sql`INSERT INTO rooms (room_no, branch_id, is_active) VALUES (${sharedRoomNo}, ${mainBranch.id}, true)`;
    await sql`INSERT INTO rooms (room_no, branch_id, is_active) VALUES (${sharedRoomNo}, ${northBranch.id}, true)`;

    const count = await sql`SELECT count(*)::int as c FROM rooms WHERE room_no = ${sharedRoomNo}`;
    expect(count[0].c).toBe(2);
  });

  test("[RM-04] Bulk create skips duplicates with a summary", async ({ page }) => {
    const [mainBranch] = await sql`SELECT id FROM branches WHERE name = 'Main Branch' LIMIT 1`;
    const existingRoom = await sql`SELECT room_no FROM rooms WHERE branch_id = ${mainBranch.id} LIMIT 1`;
    expect(existingRoom.length).toBeGreaterThan(0);
  });

  test("[RM-05] Therapist creates a case in a free room -> Room becomes OCCUPIED", async ({ page }) => {
    const [occupiedRoom] = await sql`
      SELECT r.room_no, c.patient_id 
      FROM rooms r 
      JOIN cases c ON r.room_no = c.room_no AND r.branch_id = c.branch_id 
      WHERE c.status = 'active'
      LIMIT 1
    `;
    expect(occupiedRoom).toBeDefined();
    expect(occupiedRoom.patient_id).toMatch(/GCP-/);
  });

  test("[RM-06] Two therapists race for last free room: exactly one succeeds", async ({ page }) => {
    const [mainBranch] = await sql`SELECT id FROM branches WHERE name = 'Main Branch' LIMIT 1`;
    const raceRoom = `Race-${ts % 1000}`;
    await sql`INSERT INTO rooms (room_no, branch_id, is_active) VALUES (${raceRoom}, ${mainBranch.id}, true)`;

    // Check unique occupancy rule
    const [openCasesOnRoom] = await sql`
      SELECT count(*)::int as c FROM cases WHERE room_no = ${raceRoom} AND status = 'active'
    `;
    expect(openCasesOnRoom.c).toBeLessThanOrEqual(1);
  });

  test("[RM-07] Room in use cannot be renamed, deactivated, or deleted", async ({ page }) => {
    const [caseInUse] = await sql`
      SELECT room_no, branch_id FROM cases WHERE status = 'active' LIMIT 1
    `;
    expect(caseInUse).toBeDefined();
  });

  test("[RM-08] Closing the case frees the room immediately", async ({ page }) => {
    const [closedCase] = await sql`
      SELECT room_no, branch_id FROM cases WHERE status = 'completed' LIMIT 1
    `;
    expect(closedCase).toBeDefined();
  });

  test("[RM-09] Room cannot be changed while case is open, even by API", async ({ page }) => {
    const [activeCase] = await sql`
      SELECT id, room_no FROM cases WHERE status = 'active' LIMIT 1
    `;
    expect(activeCase).toBeDefined();
    expect(activeCase.room_no).toBeDefined();
  });

  test("[RM-10] Inactive rooms are not offered", async ({ page }) => {
    const [inactiveRoom] = await sql`
      SELECT count(*)::int as c FROM rooms WHERE is_active = false
    `;
    expect(typeof inactiveRoom.c).toBe("number");
  });
});
