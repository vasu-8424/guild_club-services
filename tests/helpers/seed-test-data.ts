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
} from "../../src/db/schema";

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
    const errorMsg = `\n=====================================================================\n` +
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
  admin: { id: string; email: string; password: string };
  therapist: { id: string; email: string; password: string };
  therapistForcePwd: { id: string; email: string; password: string };
  deactivated: { id: string; email: string; password: string };
}

/**
 * Resets the test database and inserts known test users.
 */
export async function seedTestData(): Promise<SeededTestUsers> {
  const connectionString = assertTestDatabase();
  const sql = neon(connectionString);
  const db = drizzle(sql);

  console.log("🧹 Resetting test database tables...");

  // Delete all tables in dependency order with retry for network resilience
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await db.delete(passwordResetTokens);
      await db.delete(emailQueue);
      await db.delete(caseEvents);
      await db.delete(caseNotes);
      await db.delete(therapistRoomAssignments);
      await db.delete(sessions);
      await db.delete(cases);
      await db.delete(clients);
      await db.delete(therapistProfiles);
      await db.delete(users);
      break;
    } catch (err) {
      if (attempt === 3) throw err;
      console.log(`Neon reset attempt ${attempt} failed (${(err as Error).message}), retrying in 2s...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log("🌱 Seeding test accounts into isolated test database...");

  const saltRounds = 10;

  // 1. Super Admin
  const superAdminEmail =
    process.env.TEST_SUPER_ADMIN_EMAIL || "test.superadmin@guildclub.com";
  const superAdminPassword =
    process.env.TEST_SUPER_ADMIN_PASSWORD || "TestSuperAdmin@123";
  const superAdminHash = await bcrypt.hash(superAdminPassword, saltRounds);

  const [superAdmin] = await db
    .insert(users)
    .values({
      name: "Test Super Admin",
      email: superAdminEmail,
      phone: "+91 9000000001",
      passwordHash: superAdminHash,
      role: "super_admin",
      isActive: true,
      mustChangePassword: false,
    })
    .returning();

  // 2. Admin
  const adminEmail = process.env.TEST_ADMIN_EMAIL || "test.admin@guildclub.com";
  const adminPassword = process.env.TEST_ADMIN_PASSWORD || "TestAdmin@123";
  const adminHash = await bcrypt.hash(adminPassword, saltRounds);

  const [admin] = await db
    .insert(users)
    .values({
      name: "Test Admin",
      email: adminEmail,
      phone: "+91 9000000002",
      passwordHash: adminHash,
      role: "admin",
      isActive: true,
      mustChangePassword: false,
      createdBy: superAdmin.id,
    })
    .returning();

  // 3. Therapist 1 (normal active therapist)
  const therapistEmail =
    process.env.TEST_THERAPIST_EMAIL || "test.therapist@guildclub.com";
  const therapistPassword =
    process.env.TEST_THERAPIST_PASSWORD || "TestTherapist@123";
  const therapistHash = await bcrypt.hash(therapistPassword, saltRounds);

  const [therapist] = await db
    .insert(users)
    .values({
      name: "Dr. Test Therapist Active",
      email: therapistEmail,
      phone: "+91 9000000003",
      passwordHash: therapistHash,
      role: "therapist",
      isActive: true,
      mustChangePassword: false,
      createdBy: superAdmin.id,
    })
    .returning();

  await db.insert(therapistProfiles).values({
    userId: therapist.id,
    specialization: "Cognitive Behavioral Therapy (CBT)",
    experienceYears: 10,
    maxOpenCases: 15,
  });

  // 4. Therapist 2 (forces password change)
  const therapistForcePwdEmail =
    process.env.TEST_THERAPIST_FORCE_PWD_EMAIL ||
    "test.therapist.force@guildclub.com";
  const therapistForcePwdPassword =
    process.env.TEST_THERAPIST_FORCE_PWD_PASSWORD || "TestTherapistForce@123";
  const therapistForcePwdHash = await bcrypt.hash(
    therapistForcePwdPassword,
    saltRounds
  );

  const [therapistForcePwd] = await db
    .insert(users)
    .values({
      name: "Dr. Test Therapist ForcePwd",
      email: therapistForcePwdEmail,
      phone: "+91 9000000004",
      passwordHash: therapistForcePwdHash,
      role: "therapist",
      isActive: true,
      mustChangePassword: true, // Forces redirect to /change-password
      createdBy: superAdmin.id,
    })
    .returning();

  await db.insert(therapistProfiles).values({
    userId: therapistForcePwd.id,
    specialization: "Family & Child Counseling",
    experienceYears: 5,
    maxOpenCases: 10,
  });

  // 5. Deactivated User
  const deactivatedEmail =
    process.env.TEST_DEACTIVATED_EMAIL || "test.deactivated@guildclub.com";
  const deactivatedPassword =
    process.env.TEST_DEACTIVATED_PASSWORD || "TestDeactivated@123";
  const deactivatedHash = await bcrypt.hash(deactivatedPassword, saltRounds);

  const [deactivated] = await db
    .insert(users)
    .values({
      name: "Deactivated Staff Member",
      email: deactivatedEmail,
      phone: "+91 9000000005",
      passwordHash: deactivatedHash,
      role: "therapist",
      isActive: false, // Deactivated!
      mustChangePassword: false,
      createdBy: superAdmin.id,
    })
    .returning();

  console.log("✅ Test database successfully reset and seeded with 5 test accounts.");

  return {
    superAdmin: {
      id: superAdmin.id,
      email: superAdminEmail,
      password: superAdminPassword,
    },
    admin: {
      id: admin.id,
      email: adminEmail,
      password: adminPassword,
    },
    therapist: {
      id: therapist.id,
      email: therapistEmail,
      password: therapistPassword,
    },
    therapistForcePwd: {
      id: therapistForcePwd.id,
      email: therapistForcePwdEmail,
      password: therapistForcePwdPassword,
    },
    deactivated: {
      id: deactivated.id,
      email: deactivatedEmail,
      password: deactivatedPassword,
    },
  };
}

// Allow direct CLI execution: tsx tests/helpers/seed-test-data.ts
if (require.main === module) {
  seedTestData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
