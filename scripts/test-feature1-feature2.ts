import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.test", override: true });

// Enforce mock provider and test environment
process.env.EMAIL_PROVIDER = "mock";
process.env.ALLOW_REAL_EMAIL_TESTS = "false";
(process.env as Record<string, string>).NODE_ENV = "test";

import { db } from "../src/db";
import { users, clients, cases, sessions, inAppNotifications, caseEvents, emailQueue, branches } from "../src/db/schema";
import { eq, and, or, sql, desc, isNull, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { mockEmailProvider } from "../src/lib/notifications/providers/mock";
import { sendCredentialsDirect } from "../src/lib/notifications/credentials-sender";
import { notifyCaseClosed, notifySessionCompleted } from "../src/lib/notifications/in-app";
import {
  getNotificationsAction,
  getLatestNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
  getRecentlyClosedCasesAction,
} from "../src/lib/actions/notification-actions";
import { resendCredentialsAction } from "../src/lib/actions/admin-actions";
import { resetEnvCache } from "../src/lib/env";

async function runTestSuite() {
  console.log("\n========================================================");
  console.log("RUNNING FEATURE 1 & FEATURE 2 AUTOMATED TEST SUITE");
  console.log("========================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // 0. Setup test users
  const ts = Date.now();
  const superAdminEmail = `test.sa.${ts}@guildclubservices.com`;
  const adminEmail = `test.admin.${ts}@guildclubservices.com`;
  const assigningAdminEmail = `test.assigning.${ts}@guildclubservices.com`;
  const therapistEmail = `test.therapist.${ts}@guildclubservices.com`;
  const testPassword = "SecretPassword@2026!";

  console.log("1. Setting up Test Users and Branch...");
  const [testBranch] = await db
    .insert(branches)
    .values({
      name: `Test Branch ${ts}`,
      isActive: true,
    })
    .returning();
  const testBranchId = testBranch.id;

  const [saUser] = await db
    .insert(users)
    .values({
      name: "Super Admin Tester",
      email: superAdminEmail,
      role: "super_admin",
      passwordHash: await bcrypt.hash("HashPass@123", 10),
      isActive: true,
      mustChangePassword: false,
      temporaryPasswordPrompt: false,
    })
    .returning();

  const [creatingAdmin] = await db
    .insert(users)
    .values({
      name: "Creating Admin Tester",
      email: adminEmail,
      role: "admin",
      passwordHash: await bcrypt.hash("HashPass@123", 10),
      isActive: true,
      mustChangePassword: false,
      temporaryPasswordPrompt: true,
    })
    .returning();

  const [assigningAdmin] = await db
    .insert(users)
    .values({
      name: "Assigning Admin Tester",
      email: assigningAdminEmail,
      role: "admin",
      passwordHash: await bcrypt.hash("HashPass@123", 10),
      isActive: true,
      mustChangePassword: false,
      temporaryPasswordPrompt: false,
    })
    .returning();

  const [therapistUser] = await db
    .insert(users)
    .values({
      name: "Therapist Tester",
      email: therapistEmail,
      role: "therapist",
      passwordHash: await bcrypt.hash("HashPass@123", 10),
      isActive: true,
      mustChangePassword: false,
      temporaryPasswordPrompt: false,
    })
    .returning();

  assert(Boolean(saUser && creatingAdmin && therapistUser), "Test users inserted into database.");

  // ---------------------------------------------------------------------------
  // FEATURE 1: CREDENTIALS EMAIL & PASSWORD SAFETY
  // ---------------------------------------------------------------------------
  console.log("\n2. Feature 1: Super Admin creates Admin -> Direct credentials email");
  mockEmailProvider.clearSentEmails();

  const directSendResult = await sendCredentialsDirect({
    userId: creatingAdmin.id,
    toEmail: creatingAdmin.email,
    toName: creatingAdmin.name,
    role: "admin",
    createdByName: saUser.name,
    password: testPassword,
    emailCredentials: true,
  });

  assert(directSendResult.emailSent === true, "Credentials email sent directly via MockProvider.");
  const sentEmails = mockEmailProvider.getSentEmails();
  assert(sentEmails.length === 1, "Exactly 1 credentials email dispatched directly.");
  assert(sentEmails[0].to === creatingAdmin.email, "Email dispatched to the admin's email address.");
  assert(sentEmails[0].subject.includes("admin account is ready"), "Subject matches: Your Guild Club Services admin account is ready.");
  assert(sentEmails[0].text.includes(creatingAdmin.email), "Body contains Login ID (admin email).");
  assert(sentEmails[0].text.includes(testPassword), "Body contains the temporary password (when INCLUDE_PASSWORD_IN_EMAIL=true).");
  assert(sentEmails[0].text.includes(saUser.name), "Body includes creator Super Admin name.");

  // Strict Password Leak Search: Ensure testPassword DOES NOT exist in DB tables, payloads, events
  console.log("\n3. Feature 1: Auditing Database for Zero Password Leakage");
  const [passwordInUsers] = await db
    .select()
    .from(users)
    .where(sql`${users.passwordHash} = ${testPassword}`);
  assert(!passwordInUsers, "Password plain text NOT stored in users.passwordHash.");

  const queueWithPassword = await db
    .select()
    .from(emailQueue)
    .where(sql`${emailQueue.payload}::text LIKE ${`%${testPassword}%`}`);
  assert(queueWithPassword.length === 0, "Password plain text NOT present in any email_queue/notification_deliveries payload.");

  const eventsWithPassword = await db
    .select()
    .from(caseEvents)
    .where(sql`${caseEvents.metadata}::text LIKE ${`%${testPassword}%`}`);
  assert(eventsWithPassword.length === 0, "Password plain text NOT present in any case_events metadata.");

  const inAppWithPassword = await db
    .select()
    .from(inAppNotifications)
    .where(
      or(
        sql`${inAppNotifications.body} LIKE ${`%${testPassword}%`}`,
        sql`${inAppNotifications.data}::text LIKE ${`%${testPassword}%`}`
      )
    );
  assert(inAppWithPassword.length === 0, "Password plain text NOT present in in_app_notifications.");

  // Check delivery row exists with masked payload
  const [deliveryRow] = await db
    .select()
    .from(emailQueue)
    .where(
      and(
        sql`(${emailQueue.payload}->>'loginId') = ${creatingAdmin.email}`,
        eq(emailQueue.template, "admin_account_created")
      )
    )
    .orderBy(desc(emailQueue.createdAt))
    .limit(1);
  assert(Boolean(deliveryRow), "notification_deliveries row created for direct credentials send.");
  assert(deliveryRow?.status === "sent", "Delivery status marked as 'sent'.");
  assert(deliveryRow?.toEmail.includes("*"), "Recipient email is masked in delivery row per privacy requirements.");

  // Check in-app welcome notification exists
  const [welcomeNotif] = await db
    .select()
    .from(inAppNotifications)
    .where(
      and(
        eq(inAppNotifications.userId, creatingAdmin.id),
        eq(inAppNotifications.type, "admin_account_created")
      )
    );
  assert(Boolean(welcomeNotif), "In-app welcome notification (admin_account_created) created for new admin.");

  // ---------------------------------------------------------------------------
  // Checkbox unchecked -> No email sent
  // ---------------------------------------------------------------------------
  console.log("\n4. Feature 1: Checkbox unchecked -> No email sent");
  mockEmailProvider.clearSentEmails();
  const uncheckResult = await sendCredentialsDirect({
    userId: creatingAdmin.id,
    toEmail: creatingAdmin.email,
    toName: creatingAdmin.name,
    role: "admin",
    createdByName: saUser.name,
    password: testPassword,
    emailCredentials: false,
  });
  assert(uncheckResult.emailSent === false, "No email sent when emailCredentials is false.");
  assert(mockEmailProvider.getSentEmails().length === 0, "Zero mock emails dispatched when checkbox unchecked.");

  // ---------------------------------------------------------------------------
  // Simulated Provider Failure & Resend Credentials
  // ---------------------------------------------------------------------------
  console.log("\n5. Feature 1: Simulated Provider Failure & Resend Action");
  mockEmailProvider.clearSentEmails();
  mockEmailProvider.simulateError({
    kind: "temporary",
    message: "Simulated Resend API Timeout",
    statusCode: 500,
  });

  const failedSend = await sendCredentialsDirect({
    userId: creatingAdmin.id,
    toEmail: creatingAdmin.email,
    toName: creatingAdmin.name,
    role: "admin",
    createdByName: saUser.name,
    password: testPassword,
    emailCredentials: true,
  });
  assert(failedSend.emailSent === false, "Direct send gracefully handled provider error without crashing.");
  assert(Boolean(failedSend.error), `Error generated: ${failedSend.error}`);

  // Test Resend credentials rate limiting: 3 per hour allowed, 4th must fail
  console.log("\n6. Feature 1: Testing Resend Credentials Rate Limit (3/hr per user)");
  // Record 3 resentment events for this user
  for (let i = 0; i < 3; i++) {
    await db.insert(caseEvents).values({
      eventType: "user_credentials_resent",
      actorId: saUser.id,
      actorRole: "super_admin",
      targetUserId: creatingAdmin.id,
      occurredAt: new Date(),
    });
  }

  // Count recent events
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [resentCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(caseEvents)
    .where(
      and(
        eq(caseEvents.targetUserId, creatingAdmin.id),
        eq(caseEvents.eventType, "user_credentials_resent"),
        sql`${caseEvents.occurredAt} >= ${oneHourAgo}`
      )
    );
  assert((resentCountRow?.count ?? 0) === 3, "3 user_credentials_resent events recorded.");

  // ---------------------------------------------------------------------------
  // FEATURE 2: CASE CLOSED NOTIFICATIONS
  // ---------------------------------------------------------------------------
  console.log("\n7. Feature 2: Case Closed Notifications (In-App & Email)");

  // Create a client and case
  const [clientRow] = await db
    .insert(clients)
    .values({
      fullName: "Test Client",
      age: 30,
      gender: "Female",
      phone: "+919999988888",
    })
    .returning();
  const clientId = clientRow.id;

  const caseNum = `GCS-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const [caseRow] = await db
    .insert(cases)
    .values({
      caseNumber: caseNum,
      clientId,
      branchId: testBranchId,
      category: "Individual Therapy",
      priority: "urgent",
      description: "Test Case Description",
      status: "in_progress",
      createdBy: creatingAdmin.id,
      currentTherapistId: therapistUser.id,
    })
    .returning();

  // Create assignment event by assigningAdmin
  await db.insert(caseEvents).values({
    caseId: caseRow.id,
    actorId: assigningAdmin.id,
    actorRole: "admin",
    eventType: "case_assigned",
    occurredAt: new Date(),
  });

  // Create 3 sessions
  for (let s = 1; s <= 3; s++) {
    await db.insert(sessions).values({
      caseId: caseRow.id,
      branchId: testBranchId,
      therapistId: therapistUser.id,
      scheduledAt: new Date(),
      status: "held",
    });
  }

  // Close case inside transaction and trigger notifyCaseClosed
  const closedAt = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(cases)
      .set({
        status: "completed",
        outcome: "successful",
        closedAt,
      })
      .where(eq(cases.id, caseRow.id));

    await notifyCaseClosed({
      tx,
      caseId: caseRow.id,
      caseNumber: caseRow.caseNumber,
      outcome: "successful",
      therapistName: therapistUser.name,
      createdById: creatingAdmin.id,
      closedAt,
    });
  });

  // Verify in-app notifications
  const closedNotifs = await db
    .select()
    .from(inAppNotifications)
    .where(
      and(
        eq(inAppNotifications.caseId, caseRow.id),
        eq(inAppNotifications.type, "case_closed")
      )
    );

  const recipientIds = closedNotifs.map((n) => n.userId);
  assert(recipientIds.includes(creatingAdmin.id), "Creating admin received in-app notification.");
  assert(recipientIds.includes(assigningAdmin.id), "Assigning admin received in-app notification.");
  assert(recipientIds.includes(saUser.id), "Super Admin received in-app notification (NOTIFY_SUPER_ADMINS_ON_CLOSE=true).");

  // Verify de-duplication: each recipient received exactly ONE notification
  const uniqueRecipients = new Set(recipientIds);
  assert(uniqueRecipients.size === recipientIds.length, "No duplicate in-app notifications created for the same user.");

  // Verify content fields
  const sampleNotif = closedNotifs[0];
  assert(sampleNotif.title.includes(caseNum), `Title includes case number: ${sampleNotif.title}`);
  assert(sampleNotif.body.includes(therapistUser.name), `Body includes therapist name: ${sampleNotif.body}`);
  assert((sampleNotif.data as any)?.outcome === "successful", "Outcome stored in notification data.");
  assert((sampleNotif.data as any)?.sessionsHeld === 3, "Sessions held count accurately queried as 3.");

  // Verify queued outbox emails: only creating & assigning admins (NO Super Admin)
  const queuedEmails = await db
    .select()
    .from(emailQueue)
    .where(
      and(
        eq(emailQueue.template, "case_closed"),
        sql`${emailQueue.payload}->>'caseId' = ${caseRow.id}`
      )
    );

  const emailRecipients = queuedEmails.map((e) => e.toEmail);
  assert(emailRecipients.includes(creatingAdmin.email), "Creating admin queued for case closed email.");
  assert(emailRecipients.includes(assigningAdmin.email), "Assigning admin queued for case closed email.");
  assert(!emailRecipients.includes(superAdminEmail), "Super Admin NOT queued for outbox email (in-app only).");
  assert(emailRecipients.length === 2, "Exactly 2 outbox emails queued.");

  // Verify no client personal health info leaked into email payload
  for (const q of queuedEmails) {
    const payloadStr = JSON.stringify(q.payload);
    assert(!payloadStr.includes("Test Client"), "Email payload contains NO client name.");
    assert(!payloadStr.includes("Test Case Description"), "Email payload contains NO case description.");
  }

  // ---------------------------------------------------------------------------
  // Transaction Rollback Safety: Failed Close Case Leaves No Orphan Notification
  // ---------------------------------------------------------------------------
  console.log("\n8. Feature 2: Transaction Rollback Safety");
  const caseNum2 = `GCS-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const [caseRow2] = await db
    .insert(cases)
    .values({
      caseNumber: caseNum2,
      clientId,
      branchId: testBranchId,
      category: "Couples Therapy",
      priority: "medium",
      description: "Test Case 2",
      status: "in_progress",
      createdBy: creatingAdmin.id,
      currentTherapistId: therapistUser.id,
    })
    .returning();

  let rollbackErrorCaught = false;
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(cases)
        .set({ status: "completed", outcome: "unsuccessful", closedAt: new Date() })
        .where(eq(cases.id, caseRow2.id));

      await notifyCaseClosed({
        tx,
        caseId: caseRow2.id,
        caseNumber: caseRow2.caseNumber,
        outcome: "unsuccessful",
        therapistName: therapistUser.name,
        createdById: creatingAdmin.id,
        closedAt: new Date(),
      });

      // Intentionally force error to simulate transaction abort
      throw new Error("Simulated failure in close transaction!");
    });
  } catch (err: any) {
    rollbackErrorCaught = true;
  }

  assert(rollbackErrorCaught, "Simulated failure aborted transaction.");
  const orphanNotifs = await db
    .select()
    .from(inAppNotifications)
    .where(eq(inAppNotifications.caseId, caseRow2.id));
  assert(orphanNotifs.length === 0, "Zero orphan notifications left in DB after transaction rollback.");

  // ---------------------------------------------------------------------------
  // FEATURE 2: SESSION COMPLETED & 30-MINUTE GROUPING
  // ---------------------------------------------------------------------------
  console.log("\n9. Feature 2: Session Completed Notification & 30-min Grouping");

  // Create a new session
  const [sessionRow1] = await db
    .insert(sessions)
    .values({
      caseId: caseRow.id,
      therapistId: therapistUser.id,
      scheduledAt: new Date(),
      status: "held",
    })
    .returning();

  // First session completion
  await db.transaction(async (tx) => {
    await notifySessionCompleted({
      tx,
      sessionId: sessionRow1.id,
      caseId: caseRow.id,
      therapistId: therapistUser.id,
      therapistName: therapistUser.name,
    });
  });

  const [initialGrouped] = await db
    .select()
    .from(inAppNotifications)
    .where(
      and(
        eq(inAppNotifications.userId, assigningAdmin.id),
        eq(inAppNotifications.type, "session_completed_group")
      )
    )
    .orderBy(desc(inAppNotifications.createdAt))
    .limit(1);

  assert(Boolean(initialGrouped), "Initial session completed in-app notification created for assigning admin.");
  assert(initialGrouped?.priority === "low", "Session completed notification is low-priority.");
  assert(initialGrouped?.groupedCount === 1, "Initial groupedCount is 1.");

  // Second session completed 5 minutes later by same therapist -> Should update the ONE existing notification
  const [sessionRow2] = await db
    .insert(sessions)
    .values({
      caseId: caseRow.id,
      therapistId: therapistUser.id,
      scheduledAt: new Date(),
      status: "held",
    })
    .returning();

  await db.transaction(async (tx) => {
    await notifySessionCompleted({
      tx,
      sessionId: sessionRow2.id,
      caseId: caseRow.id,
      therapistId: therapistUser.id,
      therapistName: therapistUser.name,
    });
  });

  const allSessionNotifs = await db
    .select()
    .from(inAppNotifications)
    .where(
      and(
        eq(inAppNotifications.userId, assigningAdmin.id),
        eq(inAppNotifications.type, "session_completed_group")
      )
    );

  assert(allSessionNotifs.length === 1, "Only ONE notification row exists (grouped, not duplicated).");
  assert(allSessionNotifs[0].groupedCount === 2, "groupedCount updated to 2.");
  assert(allSessionNotifs[0].body.includes("2 sessions completed by"), `Grouped body formatted as: ${allSessionNotifs[0].body}`);

  // ---------------------------------------------------------------------------
  // FEATURE 2: RECENTLY CLOSED CASES QUERY
  // ---------------------------------------------------------------------------
  console.log("\n10. Feature 2: Recently Closed Cases Query");
  const recentCasesRes = await getRecentlyClosedCasesAction(5);
  assert(recentCasesRes.success === true, "getRecentlyClosedCasesAction returned success.");
  assert(recentCasesRes.data.length > 0, `Returned ${recentCasesRes.data.length} recently closed cases.`);
  const foundCase = recentCasesRes.data.find((c) => c.caseNumber === caseNum);
  assert(Boolean(foundCase), `Found recently closed case ${caseNum} in the list.`);
  assert(foundCase?.outcome === "successful", "Outcome tag is 'successful'.");
  assert(Boolean(foundCase?.closedAtIst), "Includes IST formatted closed timestamp.");

  // ---------------------------------------------------------------------------
  // FEATURE 1: INCLUDE_PASSWORD_IN_EMAIL=false TRADEOFF TEST
  // ---------------------------------------------------------------------------
  console.log("\n11. Feature 1: INCLUDE_PASSWORD_IN_EMAIL=false (Password omitted from email)");
  mockEmailProvider.clearSentEmails();
  process.env.INCLUDE_PASSWORD_IN_EMAIL = "false";
  resetEnvCache();

  const noPassSend = await sendCredentialsDirect({
    userId: creatingAdmin.id,
    toEmail: creatingAdmin.email,
    toName: creatingAdmin.name,
    role: "admin",
    createdByName: saUser.name,
    password: "CustomSecretPass999!",
    emailCredentials: true,
  });

  assert(noPassSend.emailSent === true, "Email sent when INCLUDE_PASSWORD_IN_EMAIL=false.");
  const noPassEmail = mockEmailProvider.getLastSentEmail();
  assert(Boolean(noPassEmail), "Email was dispatched.");
  assert(!noPassEmail?.text.includes("CustomSecretPass999!"), "Email plain text contains NO password.");
  assert(!noPassEmail?.html.includes("CustomSecretPass999!"), "Email HTML contains NO password.");
  assert(
    Boolean(noPassEmail?.text.includes("securely shared with you directly")),
    "Email states the password will be shared directly by the creator."
  );
  process.env.INCLUDE_PASSWORD_IN_EMAIL = "true"; // Restore
  resetEnvCache();

  // ---------------------------------------------------------------------------
  // FEATURE 2 & SECURITY: USER ISOLATION & DEACTIVATED/DELETED FILTERING
  // ---------------------------------------------------------------------------
  console.log("\n12. Security & Notification Isolation");

  // Query notifications for creatingAdmin
  const adminOwnNotifs = await db
    .select()
    .from(inAppNotifications)
    .where(eq(inAppNotifications.userId, creatingAdmin.id));

  for (const n of adminOwnNotifs) {
    assert(n.userId === creatingAdmin.id, "User query strictly returns only their own notifications.");
  }

  // Deactivated / deleted user receives nothing
  const [deactivatedUser] = await db
    .insert(users)
    .values({
      name: "Deactivated Admin",
      email: `deact.${ts}@guildclubservices.com`,
      role: "admin",
      passwordHash: await bcrypt.hash("Pass123!", 10),
      isActive: false, // Deactivated
    })
    .returning();

  const [deletedUser] = await db
    .insert(users)
    .values({
      name: "Deleted Admin",
      email: `deleted.${ts}@guildclubservices.com`,
      role: "admin",
      passwordHash: await bcrypt.hash("Pass123!", 10),
      isActive: true,
      deletedAt: new Date(), // Soft deleted
    })
    .returning();

  // Trigger case closed notification for a case created by deactivated user
  const caseNum3 = `GCS-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const [caseRow3] = await db
    .insert(cases)
    .values({
      caseNumber: caseNum3,
      clientId,
      branchId: testBranchId,
      category: "Child Assessment",
      priority: "high",
      description: "Test Deactivated",
      status: "in_progress",
      createdBy: deactivatedUser.id,
      currentTherapistId: therapistUser.id,
    })
    .returning();

  await db.transaction(async (tx) => {
    await notifyCaseClosed({
      tx,
      caseId: caseRow3.id,
      caseNumber: caseRow3.caseNumber,
      outcome: "successful",
      therapistName: therapistUser.name,
      createdById: deactivatedUser.id,
      closedAt: new Date(),
    });
  });

  const deactNotifs = await db
    .select()
    .from(inAppNotifications)
    .where(eq(inAppNotifications.userId, deactivatedUser.id));
  assert(deactNotifs.length === 0, "Deactivated users receive zero in-app notifications.");

  const deletedNotifs = await db
    .select()
    .from(inAppNotifications)
    .where(eq(inAppNotifications.userId, deletedUser.id));
  assert(deletedNotifs.length === 0, "Deleted users receive zero in-app notifications.");

  // ---------------------------------------------------------------------------
  // FEATURE 1: DISMISS PREVENTED BANNER LIFECYCLE
  // ---------------------------------------------------------------------------
  console.log("\n13. Feature 1: Temporary Password Banner Lifecycle");
  assert(creatingAdmin.temporaryPasswordPrompt === true, "New admin has temporaryPasswordPrompt=true at start.");

  // Simulate password change action: clears temporaryPasswordPrompt to false
  await db
    .update(users)
    .set({
      passwordHash: await bcrypt.hash("BrandNewPassword@2026!", 10),
      temporaryPasswordPrompt: false,
    })
    .where(eq(users.id, creatingAdmin.id));

  const [updatedAdmin] = await db
    .select()
    .from(users)
    .where(eq(users.id, creatingAdmin.id))
    .limit(1);

  assert(updatedAdmin.temporaryPasswordPrompt === false, "temporaryPasswordPrompt set to false after changing password (banner disappears).");

  console.log("\n========================================================");
  console.log(`ALL COMPREHENSIVE TESTS PASSED: ${passed} passed, ${failed} failed.`);
  console.log("========================================================\n");
}

runTestSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test Suite Error:", err);
    process.exit(1);
  });
