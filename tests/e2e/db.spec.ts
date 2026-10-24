import { test, expect } from "@playwright/test";
import { neon, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { assertTestDatabase } from "../helpers/seed-test-data";
import { recordEvent } from "../../src/lib/events";
import { cases, clients, caseEvents } from "../../src/db/schema";
import { execSync } from "child_process";

test.describe("F. Database Schema, Integrity & Events", () => {
  const dbUrl = assertTestDatabase();
  const sql = neon(dbUrl);
  const pool = new Pool({ connectionString: dbUrl });
  const db = drizzle(pool);

  test.afterAll(async () => {
    await pool.end();
  });

  test("DB-01: All Stage 1 tables exist with expected schema", async () => {
    const expectedTables = [
      "users",
      "therapist_profiles",
      "clients",
      "cases",
      "sessions",
      "case_notes",
      "case_events",
      "email_queue",
    ];

    const result = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;

    const existingTables = result.map((r) => r.table_name);
    for (const t of expectedTables) {
      expect(existingTables).toContain(t);
    }
  });

  test("DB-02: Enums exist for user_role, case_status, case_outcome, and case_priority with correct values", async () => {
    const enumTypes = await sql`
      SELECT t.typname, e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
    `;

    const grouped: Record<string, string[]> = {};
    for (const row of enumTypes) {
      if (!grouped[row.typname]) grouped[row.typname] = [];
      grouped[row.typname].push(row.enumlabel);
    }

    expect(grouped["user_role"]).toEqual(expect.arrayContaining(["super_admin", "admin", "therapist"]));
    expect(grouped["case_status"]).toEqual(
      expect.arrayContaining(["new", "assigned", "accepted", "in_progress", "on_hold", "completed"])
    );
    expect(grouped["case_outcome"]).toEqual(
      expect.arrayContaining(["successful", "unsuccessful", "referred"])
    );
    expect(grouped["case_priority"]).toEqual(
      expect.arrayContaining(["low", "medium", "high", "urgent"])
    );
  });

  test("DB-03: Indexes exist on case_events (occurred_at, actor_id+occurred_at, case_id+occurred_at)", async () => {
    const indexes = await sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'case_events'
    `;

    const indexNames = indexes.map((i) => i.indexname);
    expect(indexNames).toContain("case_events_occurred_at_idx");
    expect(indexNames).toContain("case_events_actor_occurred_idx");
    expect(indexNames).toContain("case_events_case_occurred_idx");
  });

  test("DB-04: Unique constraints work (duplicate email and duplicate case_number are rejected)", async () => {
    // 1. Duplicate email rejection
    const [existing] = await sql`SELECT email, password_hash, role FROM users LIMIT 1`;
    expect(existing).toBeDefined();

    let emailErrorCaught = false;
    try {
      await sql`
        INSERT INTO users (name, email, password_hash, role)
        VALUES ('Duplicate Person', ${existing.email}, ${existing.password_hash}, ${existing.role})
      `;
    } catch {
      emailErrorCaught = true;
    }
    expect(emailErrorCaught).toBe(true);

    // 2. Duplicate case_number rejection
    // Create a dummy client first
    const [testClient] = await db
      .insert(clients)
      .values({
        fullName: "Test Constraint Client",
        age: 30,
        gender: "Female",
        phone: "+91 9999999991",
      })
      .returning();

    const [adminUser] = await sql`SELECT id FROM users WHERE role = 'admin' LIMIT 1`;

    await db.insert(cases).values({
      caseNumber: "GCS-2026-TEST-UNIQUE",
      clientId: testClient.id,
      category: "Stress Management",
      priority: "medium",
      description: "First instance",
      status: "new",
      createdBy: adminUser.id,
    });

    let caseNumberErrorCaught = false;
    try {
      await db.insert(cases).values({
        caseNumber: "GCS-2026-TEST-UNIQUE", // Duplicate case number!
        clientId: testClient.id,
        category: "Stress Management",
        priority: "medium",
        description: "Second duplicate instance",
        status: "new",
        createdBy: adminUser.id,
      });
    } catch {
      caseNumberErrorCaught = true;
    }
    expect(caseNumberErrorCaught).toBe(true);
  });

  test("DB-05: All timestamp columns use timestamptz (timestamp with time zone)", async () => {
    const timestampCols = await sql`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND column_name LIKE '%_at'
    `;

    for (const col of timestampCols) {
      expect(col.data_type, `${col.table_name}.${col.column_name} should be timestamptz`).toBe(
        "timestamp with time zone"
      );
    }
  });

  test("DB-06: The seed script is idempotent (running it twice does not duplicate Super Admin)", async () => {
    // Run seed script first time
    execSync("npx dotenv run -f .env.test --override -- tsx src/db/seed.ts", {
      encoding: "utf-8",
      stdio: "pipe",
    });

    const beforeCount = await sql`
      SELECT count(*)::int as cnt FROM users WHERE role = 'super_admin'
    `;

    // Run seed script second time
    execSync("npx dotenv run -f .env.test --override -- tsx src/db/seed.ts", {
      encoding: "utf-8",
      stdio: "pipe",
    });

    const afterCount = await sql`
      SELECT count(*)::int as cnt FROM users WHERE role = 'super_admin'
    `;

    expect(afterCount[0].cnt).toBe(beforeCount[0].cnt);
  });

  test("DB-07: Passwords are stored as bcrypt hashes, never plain text", async () => {
    const userRows = await sql`SELECT email, password_hash FROM users`;
    expect(userRows.length).toBeGreaterThan(0);

    for (const u of userRows) {
      // Must be valid bcrypt hash format ($2a$ or $2b$) and 60 chars long
      expect(u.password_hash).toMatch(/^\$2[ab]\$[0-9]{2}\$[A-Za-z0-9./]{53}$/);
      expect(u.password_hash).not.toContain("TestSuperAdmin");
      expect(u.password_hash).not.toContain("Admin@123");
    }
  });

  test("EVT-01: recordEvent inserts a row with correct fields when called inside a transaction", async () => {
    const [actor] = await sql`SELECT id, role FROM users LIMIT 1`;

    const eventResult = await db.transaction(async (tx) => {
      return await recordEvent(tx, {
        eventType: "TEST_CASE_INITIALIZED",
        actorId: actor.id,
        actorRole: actor.role,
        metadata: { source: "playwright_automated_test", pass: true },
      });
    });

    expect(eventResult).toBeDefined();

    const [recorded] = await sql`
      SELECT event_type, actor_id, actor_role, metadata
      FROM case_events
      WHERE event_type = 'TEST_CASE_INITIALIZED' AND actor_id = ${actor.id}
      ORDER BY occurred_at DESC
      LIMIT 1
    `;

    expect(recorded).toBeDefined();
    expect(recorded.event_type).toBe("TEST_CASE_INITIALIZED");
    expect(recorded.actor_id).toBe(actor.id);
    expect(recorded.metadata).toEqual({ source: "playwright_automated_test", pass: true });
  });

  test("EVT-02: If surrounding transaction rolls back, NO event row is saved (proves atomicity)", async () => {
    const [actor] = await sql`SELECT id, role FROM users LIMIT 1`;
    const uniqueType = `ROLLBACK_EVENT_TEST_${Date.now()}`;

    try {
      await db.transaction(async (tx) => {
        await recordEvent(tx, {
          eventType: uniqueType,
          actorId: actor.id,
          actorRole: actor.role,
        });

        // Intentional rollback failure
        throw new Error("Simulated transactional failure triggering rollback");
      });
    } catch {
      // Transaction expected to abort
    }

    const check = await sql`
      SELECT count(*)::int as cnt
      FROM case_events
      WHERE event_type = ${uniqueType}
    `;

    expect(check[0].cnt).toBe(0);
  });

  test("EVT-03: occurred_at is stored in UTC and converts correctly to Asia/Kolkata across day boundary", async () => {
    const [actor] = await sql`SELECT id, role FROM users LIMIT 1`;

    // 23:59 IST on 2026-10-21 is 18:29 UTC on 2026-10-21
    const dateLateIST = new Date("2026-10-21T18:29:00Z");
    // 00:01 IST on 2026-10-22 is 18:31 UTC on 2026-10-21
    const dateEarlyIST = new Date("2026-10-21T18:31:00Z");

    const [event1] = await db
      .insert(caseEvents)
      .values({
        eventType: "BOUNDARY_TEST_DAY_1",
        actorId: actor.id,
        actorRole: actor.role,
        occurredAt: dateLateIST,
      })
      .returning();

    const [event2] = await db
      .insert(caseEvents)
      .values({
        eventType: "BOUNDARY_TEST_DAY_2",
        actorId: actor.id,
        actorRole: actor.role,
        occurredAt: dateEarlyIST,
      })
      .returning();

    // Query converting occurred_at to Asia/Kolkata date
    const rows = await sql`
      SELECT id, event_type, 
             to_char(occurred_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') as ist_date
      FROM case_events
      WHERE id IN (${event1.id}, ${event2.id})
      ORDER BY id ASC
    `;

    const dateMap = Object.fromEntries(rows.map((r) => [r.event_type, r.ist_date]));
    expect(dateMap["BOUNDARY_TEST_DAY_1"]).toBe("2026-10-21");
    expect(dateMap["BOUNDARY_TEST_DAY_2"]).toBe("2026-10-22");
  });
});
