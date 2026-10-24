import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
import { users, therapistProfiles } from "./schema";
import { eq } from "drizzle-orm";

dotenv.config();

async function seed() {
  const connectionString =
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

  if (!connectionString) {
    console.error(
      "ERROR: Neither DATABASE_URL_UNPOOLED nor DATABASE_URL is set in environment."
    );
    process.exit(1);
  }

  const sql = neon(connectionString);
  const db = drizzle(sql);

  console.log("🌱 Starting database seeding for Guild Club Services...");

  // 1. First Super Admin from Environment Variables
  const superAdminName = process.env.SUPER_ADMIN_NAME || "Guild Super Admin";
  const superAdminEmail = (
    process.env.SUPER_ADMIN_EMAIL || "superadmin@guildclub.com"
  ).toLowerCase();
  const superAdminPassword =
    process.env.SUPER_ADMIN_PASSWORD || "ChangeMe@12345";
  const superAdminPhone = process.env.SUPER_ADMIN_PHONE || "+91 9876543210";
  const superAdminMustChange =
    process.env.SUPER_ADMIN_MUST_CHANGE_PASSWORD === "true";

  const existingSuperAdmin = await db
    .select()
    .from(users)
    .where(eq(users.email, superAdminEmail))
    .limit(1);

  let superAdminId: string;

  if (existingSuperAdmin.length > 0) {
    console.log(
      `ℹ️  Super Admin with email "${superAdminEmail}" already exists. Skipping creation.`
    );
    superAdminId = existingSuperAdmin[0].id;
  } else {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(superAdminPassword, salt);

    const [createdSuperAdmin] = await db
      .insert(users)
      .values({
        name: superAdminName,
        email: superAdminEmail,
        phone: superAdminPhone,
        passwordHash,
        role: "super_admin",
        isActive: true,
        mustChangePassword: superAdminMustChange,
      })
      .returning();

    superAdminId = createdSuperAdmin.id;
    console.log(`✅ Super Admin created successfully!`);
    console.log(`   Email: ${superAdminEmail}`);
    console.log(`   Password: ${superAdminPassword}`);
    console.log(`   Role: super_admin`);
    console.log(`   Must Change Password: ${superAdminMustChange}`);
  }

  // 2. Demo Admin Account for testing role-based access
  const adminEmail = "admin@guildclub.com";
  const adminPassword = "Admin@12345";
  const existingAdmin = await db
    .select()
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);

  if (existingAdmin.length === 0) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    await db.insert(users).values({
      name: "Standard Administrator",
      email: adminEmail,
      phone: "+91 9876543211",
      passwordHash,
      role: "admin",
      isActive: true,
      mustChangePassword: false,
      createdBy: superAdminId,
    });
    console.log(`✅ Demo Admin created: ${adminEmail} / ${adminPassword}`);
  }

  // 3. Demo Therapist Account (with mustChangePassword: true to test password change flow)
  const therapistEmail = "therapist@guildclub.com";
  const therapistPassword = "Therapist@12345";
  const existingTherapist = await db
    .select()
    .from(users)
    .where(eq(users.email, therapistEmail))
    .limit(1);

  if (existingTherapist.length === 0) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(therapistPassword, salt);

    const [createdTherapist] = await db
      .insert(users)
      .values({
        name: "Dr. Ananya Sharma",
        email: therapistEmail,
        phone: "+91 9876543212",
        passwordHash,
        role: "therapist",
        isActive: true,
        mustChangePassword: true, // Forces redirect to /change-password on login
        createdBy: superAdminId,
      })
      .returning();

    // Create therapist profile
    await db.insert(therapistProfiles).values({
      userId: createdTherapist.id,
      specialization: "Cognitive Behavioral Therapy (CBT) & Anxiety Management",
      experienceYears: 8,
      maxOpenCases: 12,
    });

    console.log(
      `✅ Demo Therapist created: ${therapistEmail} / ${therapistPassword} (mustChangePassword: true)`
    );
  }

  console.log("✨ Seeding completed successfully!");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seeding error:", err);
    process.exit(1);
  });
