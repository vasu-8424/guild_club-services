import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
import path from "path";
import {
  users,
  therapistProfiles,
  clients,
  cases,
  sessions,
  caseNotes,
  caseEvents,
  emailQueue,
  passwordResetTokens,
  therapistRoomAssignments,
  inAppNotifications,
  branches,
  casePhotos,
  loginRecords,
  progressReports,
  progressReportVersions,
  rooms,
  adminNotes,
  userBranches,
} from "../../src/db/schema";
import { getTodayIST, formatToISTDateString } from "../../src/lib/date-utils";

// Load test environment
dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });

/**
 * Asserts that the database connection string belongs to an isolated test branch/database.
 */
export function assertTestDatabase(url?: string): string {
  const connectionUrl = url || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

  if (!connectionUrl) {
    throw new Error(
      "❌ FATAL: Neither DATABASE_URL_UNPOOLED nor DATABASE_URL is set in .env.test!"
    );
  }

  // Safety check: must contain 'test' (e.g. neondb_test, ep-xxx-test, branch-test)
  const isTestBranch =
    connectionUrl.includes("test") ||
    connectionUrl.includes("neondb_test") ||
    connectionUrl.includes("_test");

  if (!isTestBranch) {
    const errorMsg =
      `\n=====================================================================\n` +
      `🚨 FATAL SAFETY VIOLATION: Database URL does not appear to be a TEST branch!\n` +
      `URL: ${connectionUrl.replace(/:[^:@]+@/, ":***@")}\n` +
      `Refusing to execute tests against main or production database.\n` +
      `Please ensure .env.test points to a Neon test branch or 'neondb_test'.\n` +
      `=====================================================================\n`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  return connectionUrl;
}

export interface SeededTestUsers {
  superAdmin: { id: string; email: string; password: string };
  adminMain: { id: string; email: string; password: string };
  adminBoth: { id: string; email: string; password: string };
  therapist: { id: string; email: string; password: string };
  therapist1: { id: string; email: string; password: string };
  therapist2: { id: string; email: string; password: string };
  therapist3: { id: string; email: string; password: string };
  therapistForcePwd: { id: string; email: string; password: string };
  deactivated: { id: string; email: string; password: string };
  mainBranch: { id: string; name: string };
  northBranch: { id: string; name: string };
}

/**
 * Resets the test database and inserts the complete QA test topology.
 */
export async function seedTestData(): Promise<SeededTestUsers> {
  const connectionString = assertTestDatabase();
  const sql = neon(connectionString);
  const db = drizzle(sql);

  console.log("🧹 Resetting test database tables...");

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await db.delete(passwordResetTokens);
      await db.delete(inAppNotifications);
      await db.delete(adminNotes);
      await db.delete(emailQueue);
      await db.delete(caseEvents);
      await db.delete(caseNotes);
      await db.delete(casePhotos);
      await db.delete(progressReportVersions);
      await db.delete(progressReports);
      await db.delete(therapistRoomAssignments);
      await db.delete(sessions);
      await db.delete(cases);
      await db.delete(rooms);
      await db.delete(clients);
      await db.delete(therapistProfiles);
      await db.delete(loginRecords);
      await db.delete(userBranches);
      await db.delete(users);
      await db.delete(branches);
      try {
        await sql.query(`SELECT setval('patient_id_seq', 1, false);`);
      } catch {
        // ignore if seq does not exist
      }
      break;
    } catch (err) {
      if (attempt === 3) throw err;
      console.log(`Neon reset attempt ${attempt} failed (${(err as Error).message}), retrying in 2s...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log("🌱 Seeding complete QA topology into isolated test database...");
  const saltRounds = 10;
  const todayIST = getTodayIST();

  // 1. Branches: "Main Branch" and "North Branch"
  const [mainBranch] = await db
    .insert(branches)
    .values({ name: "Main Branch", isActive: true })
    .returning();

  const [northBranch] = await db
    .insert(branches)
    .values({ name: "North Branch", isActive: true })
    .returning();

  // 2. Super Admin
  const superAdminEmail = process.env.TEST_SUPER_ADMIN_EMAIL || "qa.superadmin@guildclub.com";
  const superAdminPassword = process.env.TEST_SUPER_ADMIN_PASSWORD || "Password@Super123";
  const superAdminHash = await bcrypt.hash(superAdminPassword, saltRounds);

  const [superAdmin] = await db
    .insert(users)
    .values({
      name: "QA Super Admin",
      email: superAdminEmail,
      phone: "+91 9800000001",
      passwordHash: superAdminHash,
      role: "super_admin",
      isActive: true,
      mustChangePassword: false,
    })
    .returning();

  // 3. Admin 1: Main only
  const adminMainEmail = process.env.TEST_ADMIN_MAIN_EMAIL || "qa.admin.main@guildclub.com";
  const adminMainPassword = process.env.TEST_ADMIN_MAIN_PASSWORD || "Password@Admin123";
  const adminMainHash = await bcrypt.hash(adminMainPassword, saltRounds);

  const [adminMain] = await db
    .insert(users)
    .values({
      name: "QA Admin Main",
      email: adminMainEmail,
      phone: "+91 9800000002",
      passwordHash: adminMainHash,
      role: "admin",
      isActive: true,
      mustChangePassword: false,
      createdBy: superAdmin.id,
    })
    .returning();

  await db.insert(userBranches).values({
    userId: adminMain.id,
    branchId: mainBranch.id,
    roleInBranch: "admin",
    assignedBy: superAdmin.id,
  });

  // 4. Admin 2: Both Main and North
  const adminBothEmail = process.env.TEST_ADMIN_BOTH_EMAIL || "qa.admin.both@guildclub.com";
  const adminBothPassword = process.env.TEST_ADMIN_BOTH_PASSWORD || "Password@AdminBoth123";
  const adminBothHash = await bcrypt.hash(adminBothPassword, saltRounds);

  const [adminBoth] = await db
    .insert(users)
    .values({
      name: "QA Admin Both",
      email: adminBothEmail,
      phone: "+91 9800000003",
      passwordHash: adminBothHash,
      role: "admin",
      isActive: true,
      mustChangePassword: false,
      createdBy: superAdmin.id,
    })
    .returning();

  await db.insert(userBranches).values([
    {
      userId: adminBoth.id,
      branchId: mainBranch.id,
      roleInBranch: "admin",
      assignedBy: superAdmin.id,
    },
    {
      userId: adminBoth.id,
      branchId: northBranch.id,
      roleInBranch: "admin",
      assignedBy: superAdmin.id,
    },
  ]);

  // 5. Therapists: T1 (Main only), T2 (North only), T3 (Both Main and North)
  const t1Email = process.env.TEST_THERAPIST_1_EMAIL || "qa.therapist1.main@guildclub.com";
  const t1Password = process.env.TEST_THERAPIST_1_PASSWORD || "Password@Therapist1";
  const t1Hash = await bcrypt.hash(t1Password, saltRounds);

  const [therapist1] = await db
    .insert(users)
    .values({
      name: "Dr. QA Therapist One",
      email: t1Email,
      phone: "+91 9800000004",
      passwordHash: t1Hash,
      role: "therapist",
      isActive: true,
      mustChangePassword: false,
      createdBy: adminMain.id,
    })
    .returning();

  await db.insert(therapistProfiles).values({
    userId: therapist1.id,
    specialization: "Orthopedic Rehabilitation",
    experienceYears: 8,
    maxOpenCases: 15,
  });

  await db.insert(userBranches).values({
    userId: therapist1.id,
    branchId: mainBranch.id,
    roleInBranch: "therapist",
    assignedBy: adminMain.id,
  });

  const t2Email = process.env.TEST_THERAPIST_2_EMAIL || "qa.therapist2.north@guildclub.com";
  const t2Password = process.env.TEST_THERAPIST_2_PASSWORD || "Password@Therapist2";
  const t2Hash = await bcrypt.hash(t2Password, saltRounds);

  const [therapist2] = await db
    .insert(users)
    .values({
      name: "Dr. QA Therapist Two",
      email: t2Email,
      phone: "+91 9800000005",
      passwordHash: t2Hash,
      role: "therapist",
      isActive: true,
      mustChangePassword: false,
      createdBy: adminBoth.id,
    })
    .returning();

  await db.insert(therapistProfiles).values({
    userId: therapist2.id,
    specialization: "Neurological Physiotherapy",
    experienceYears: 6,
    maxOpenCases: 12,
  });

  await db.insert(userBranches).values({
    userId: therapist2.id,
    branchId: northBranch.id,
    roleInBranch: "therapist",
    assignedBy: adminBoth.id,
  });

  const t3Email = process.env.TEST_THERAPIST_3_EMAIL || "qa.therapist3.both@guildclub.com";
  const t3Password = process.env.TEST_THERAPIST_3_PASSWORD || "Password@Therapist3";
  const t3Hash = await bcrypt.hash(t3Password, saltRounds);

  const [therapist3] = await db
    .insert(users)
    .values({
      name: "Dr. QA Therapist Three",
      email: t3Email,
      phone: "+91 9800000006",
      passwordHash: t3Hash,
      role: "therapist",
      isActive: true,
      mustChangePassword: false,
      createdBy: adminBoth.id,
    })
    .returning();

  await db.insert(therapistProfiles).values({
    userId: therapist3.id,
    specialization: "Sports Physiotherapy",
    experienceYears: 10,
    maxOpenCases: 20,
  });

  await db.insert(userBranches).values([
    {
      userId: therapist3.id,
      branchId: mainBranch.id,
      roleInBranch: "therapist",
      assignedBy: adminBoth.id,
    },
    {
      userId: therapist3.id,
      branchId: northBranch.id,
      roleInBranch: "therapist",
      assignedBy: adminBoth.id,
    },
  ]);

  // 6. Force Password Change Therapist
  const tForceEmail = process.env.TEST_THERAPIST_FORCE_PWD_EMAIL || "qa.therapist.force@guildclub.com";
  const tForcePassword = process.env.TEST_THERAPIST_FORCE_PWD_PASSWORD || "Password@Force123";
  const tForceHash = await bcrypt.hash(tForcePassword, saltRounds);

  const [therapistForcePwd] = await db
    .insert(users)
    .values({
      name: "Dr. QA Therapist Force",
      email: tForceEmail,
      phone: "+91 9800000007",
      passwordHash: tForceHash,
      role: "therapist",
      isActive: true,
      mustChangePassword: true,
      createdBy: superAdmin.id,
    })
    .returning();

  await db.insert(userBranches).values({
    userId: therapistForcePwd.id,
    branchId: mainBranch.id,
    roleInBranch: "therapist",
    assignedBy: superAdmin.id,
  });

  // 7. Deactivated Therapist
  const deactEmail = process.env.TEST_DEACTIVATED_EMAIL || "qa.therapist.deact@guildclub.com";
  const deactPassword = process.env.TEST_DEACTIVATED_PASSWORD || "Password@Deact123";
  const deactHash = await bcrypt.hash(deactPassword, saltRounds);

  const [deactivated] = await db
    .insert(users)
    .values({
      name: "Dr. QA Deactivated Therapist",
      email: deactEmail,
      phone: "+91 9800000008",
      passwordHash: deactHash,
      role: "therapist",
      isActive: false,
      mustChangePassword: false,
      createdBy: superAdmin.id,
    })
    .returning();

  await db.insert(userBranches).values({
    userId: deactivated.id,
    branchId: mainBranch.id,
    roleInBranch: "therapist",
    assignedBy: superAdmin.id,
  });

  // 8. Rooms: 2 rooms per branch
  const [roomMain1] = await db
    .insert(rooms)
    .values({ roomNo: "101", branchId: mainBranch.id, isActive: true, createdBy: adminMain.id })
    .returning();
  const [roomMain2] = await db
    .insert(rooms)
    .values({ roomNo: "102", branchId: mainBranch.id, isActive: true, createdBy: adminMain.id })
    .returning();

  const [roomNorth1] = await db
    .insert(rooms)
    .values({ roomNo: "201", branchId: northBranch.id, isActive: true, createdBy: adminBoth.id })
    .returning();
  const [roomNorth2] = await db
    .insert(rooms)
    .values({ roomNo: "202", branchId: northBranch.id, isActive: true, createdBy: adminBoth.id })
    .returning();

  // 9. Clients and Cases: 1 closed case, 1 open case per therapist, and past sessions
  const therapistList = [
    { t: therapist1, branchId: mainBranch.id, prefix: "M1" },
    { t: therapist2, branchId: northBranch.id, prefix: "N2" },
    { t: therapist3, branchId: mainBranch.id, prefix: "B3" },
  ];

  for (const item of therapistList) {
    // Client for open case
    const [cOpen] = await db
      .insert(clients)
      .values({
        fullName: `Patient Open ${item.prefix}`,
        phone: `+91981111${item.prefix === "M1" ? "1111" : item.prefix === "N2" ? "2222" : "3333"}`,
        age: 38,
        gender: "female",
      })
      .returning();

    // Client for closed case
    const [cClosed] = await db
      .insert(clients)
      .values({
        fullName: `Patient Closed ${item.prefix}`,
        phone: `+91982222${item.prefix === "M1" ? "1111" : item.prefix === "N2" ? "2222" : "3333"}`,
        age: 52,
        gender: "male",
      })
      .returning();

    // Open Case
    const [openCase] = await db
      .insert(cases)
      .values({
        caseNumber: `GCS-QA-${item.prefix}-OPEN`,
        patientId: `GCP-9${item.prefix === "M1" ? "011" : item.prefix === "N2" ? "021" : "031"}`,
        clientId: cOpen.id,
        currentTherapistId: item.t.id,
        createdBy: item.t.id,
        branchId: item.branchId,
        service: "physiotherapy",
        category: "physiotherapy",
        priority: "medium",
        problem: `Active rehabilitation program ${item.prefix}`,
        description: `Functional motor recovery and pain management for ${item.prefix}`,
        presentCondition: "Initial assessment completed, steady progression recorded",
        startDate: todayIST,
        roomNo: item.prefix === "M1" ? "101" : item.prefix === "N2" ? "201" : "102",
        status: "active",
      })
      .returning();

    // Closed Case
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);
    const pastDateIST = formatToISTDateString(pastDate);

    const [closedCase] = await db
      .insert(cases)
      .values({
        caseNumber: `GCS-QA-${item.prefix}-CLOSED`,
        patientId: `GCP-9${item.prefix === "M1" ? "012" : item.prefix === "N2" ? "022" : "032"}`,
        clientId: cClosed.id,
        currentTherapistId: item.t.id,
        createdBy: item.t.id,
        branchId: item.branchId,
        service: "physiotherapy",
        category: "physiotherapy",
        priority: "low",
        problem: `Post-operative shoulder recovery ${item.prefix}`,
        description: `Discharged after successful rehabilitation ${item.prefix}`,
        presentCondition: "Full range of motion achieved, zero discomfort",
        startDate: pastDateIST,
        roomNo: item.prefix === "M1" ? "101" : item.prefix === "N2" ? "201" : "102",
        status: "completed",
        closedAt: new Date(),
        closingNotes: "Completed treatment program successfully",
        outcome: "successful",
      })
      .returning();

    // Past session for closed case
    await db.insert(sessions).values({
      caseId: closedCase.id,
      therapistId: item.t.id,
      branchId: item.branchId,
      sessionDate: pastDateIST,
      scheduledAt: pastDate,
      recordedAt: pastDate,
      status: "held",
      notes: `Final clinical evaluation before successful case closure for ${item.prefix}.`,
      workDone: "Full discharge assessment and home exercise plan handed over.",
      presentConditionSnapshot: "Full range of motion achieved, zero discomfort",
      signatureKey: `sig_qa_closed_${closedCase.id}.png`,
      patientSignatureKey: `sig_qa_closed_${closedCase.id}.png`,
      completedAt: pastDate,
    });
  }

  console.log("✅ Seed topology completed successfully!");

  return {
    superAdmin: { id: superAdmin.id, email: superAdminEmail, password: superAdminPassword },
    adminMain: { id: adminMain.id, email: adminMainEmail, password: adminMainPassword },
    adminBoth: { id: adminBoth.id, email: adminBothEmail, password: adminBothPassword },
    therapist: { id: therapist1.id, email: t1Email, password: t1Password },
    therapist1: { id: therapist1.id, email: t1Email, password: t1Password },
    therapist2: { id: therapist2.id, email: t2Email, password: t2Password },
    therapist3: { id: therapist3.id, email: t3Email, password: t3Password },
    therapistForcePwd: { id: therapistForcePwd.id, email: tForceEmail, password: tForcePassword },
    deactivated: { id: deactivated.id, email: deactEmail, password: deactPassword },
    mainBranch: { id: mainBranch.id, name: mainBranch.name },
    northBranch: { id: northBranch.id, name: northBranch.name },
  };
}
