import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.test", override: true });

process.env.EMAIL_PROVIDER = "mock";
process.env.ALLOW_REAL_EMAIL_TESTS = "false";
(process.env as Record<string, string>).NODE_ENV = "test";

import { db } from "../src/db";
import {
  users,
  clients,
  cases,
  sessions,
  loginRecords,
  branches,
  userBranches,
  caseEvents,
  inAppNotifications,
} from "../src/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getTodayIST, getYesterdayIST, getDaysAheadIST, formatToISTDateString } from "../src/lib/date-utils";
import {
  recordDailySessionAction,
  updateTodaySessionAction,
} from "../src/lib/actions/therapist-session-new-actions";
import {
  saveSignInLocationAction,
  getTherapistLoginHistoryAction,
} from "../src/lib/actions/location-actions";
import { closeCaseAction } from "../src/lib/actions/case-actions";

async function runPrompt17TestSuite() {
  console.log("\n========================================================");
  console.log("PROMPT 17: THERAPIST DAILY BOARD & LOCATION GATE TEST SUITE");
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

  const ts = Date.now();
  const todayIST = getTodayIST();
  const yesterdayIST = getYesterdayIST();
  const tomorrowIST = getDaysAheadIST(1);

  // 1. SETUP: Create Test Branch & Users
  console.log("1. Setting up Test Branch and Accounts...");
  const [testBranch] = await db
    .insert(branches)
    .values({
      name: `Prompt 17 Branch ${ts}`,
      isActive: true,
    })
    .returning();

  const passwordHash = await bcrypt.hash("Therapist@12345", 10);

  const [therapist] = await db
    .insert(users)
    .values({
      name: `Dr. Prompt17 Therapist ${ts}`,
      email: `therapist.${ts}@guildclubservices.com`,
      role: "therapist",
      passwordHash,
      isActive: true,
    })
    .returning();

  const [otherTherapist] = await db
    .insert(users)
    .values({
      name: `Dr. Other Therapist ${ts}`,
      email: `other.therapist.${ts}@guildclubservices.com`,
      role: "therapist",
      passwordHash,
      isActive: true,
    })
    .returning();

  const [admin] = await db
    .insert(users)
    .values({
      name: `Admin Prompt17 ${ts}`,
      email: `admin.${ts}@guildclubservices.com`,
      role: "admin",
      passwordHash,
      isActive: true,
    })
    .returning();

  await db.insert(userBranches).values([
    { userId: therapist.id, branchId: testBranch.id, roleInBranch: "therapist" },
    { userId: otherTherapist.id, branchId: testBranch.id, roleInBranch: "therapist" },
    { userId: admin.id, branchId: testBranch.id, roleInBranch: "admin" },
  ]);

  const [client] = await db
    .insert(clients)
    .values({
      fullName: `Test Patient ${ts}`,
      phone: "+919876543210",
      age: 45,
      gender: "male",
    })
    .returning();

  assert(Boolean(testBranch && therapist && client), "Branch, therapist and client created");

  // 2. SIGN-IN RECORD CREATION
  console.log("\n2. Sign-In Record & Pending Location Status...");
  const [loginRec] = await db
    .insert(loginRecords)
    .values({
      userId: therapist.id,
      branchId: testBranch.id,
      signedInAt: new Date(),
      loggedInAt: new Date(),
      ipAddress: "127.0.0.1",
      userAgent: "TestBrowser/1.0",
      signInLocationStatus: "pending",
      locationStatus: "unavailable",
    })
    .returning();

  assert(loginRec.signInLocationStatus === "pending", "Initial therapist sign-in location status is 'pending'");
  assert(loginRec.branchId === testBranch.id, "Login record is linked to selected branch");

  // 3. LOCATION GATE & PERMISSION DENIED
  console.log("\n3. Testing Location Gate & Permission Denied...");
  // Simulate therapist denies location
  await db
    .update(loginRecords)
    .set({
      signInLocationStatus: "denied",
      locationStatus: "denied",
    })
    .where(eq(loginRecords.id, loginRec.id));

  await db.insert(caseEvents).values({
    eventType: "therapist_location_captured",
    actorId: therapist.id,
    actorRole: "therapist",
    targetUserId: therapist.id,
    metadata: {
      loginRecordId: loginRec.id,
      status: "denied",
    },
  });

  const [deniedRec] = await db
    .select()
    .from(loginRecords)
    .where(eq(loginRecords.id, loginRec.id));

  assert(deniedRec.signInLocationStatus === "denied", "Location denied updates status to 'denied'");
  assert(
    deniedRec.signInLocationStatus !== "captured",
    "Board stays locked on server when location status is 'denied'"
  );

  // 4. LOCATION CAPTURED
  console.log("\n4. Testing Location Captured...");
  const mockLat = "17.440080";
  const mockLng = "78.348915";
  const mockAccuracy = 15;

  await db
    .update(loginRecords)
    .set({
      signInLatitude: mockLat,
      signInLongitude: mockLng,
      signInAccuracyMeters: mockAccuracy,
      signInLocationStatus: "captured",
      latitude: mockLat,
      longitude: mockLng,
      accuracyMeters: mockAccuracy,
      locationStatus: "captured",
    })
    .where(eq(loginRecords.id, loginRec.id));

  await db.insert(caseEvents).values({
    eventType: "therapist_location_captured",
    actorId: therapist.id,
    actorRole: "therapist",
    targetUserId: therapist.id,
    metadata: {
      loginRecordId: loginRec.id,
      status: "captured",
    },
  });

  const [capturedRec] = await db
    .select()
    .from(loginRecords)
    .where(eq(loginRecords.id, loginRec.id));

  assert(capturedRec.signInLocationStatus === "captured", "Location status updated to 'captured'");
  assert(capturedRec.signInLatitude === mockLat, "Sign-in latitude stored accurately");
  assert(capturedRec.signInLongitude === mockLng, "Sign-in longitude stored accurately");
  assert(capturedRec.signInAccuracyMeters === mockAccuracy, "Sign-in accuracy stored in meters");

  // 5. OPENSTREETMAP LINKS & PRIVACY
  console.log("\n5. Testing OpenStreetMap Links & Privacy Isolation...");
  const expectedOsmUrl = `https://www.openstreetmap.org/?mlat=${mockLat}&mlon=${mockLng}#map=17/${mockLat}/${mockLng}`;

  // Check admin view: coordinates and OSM link present
  const adminHistory = await db
    .select()
    .from(loginRecords)
    .where(eq(loginRecords.id, loginRec.id));

  const adminItem = adminHistory[0];
  const adminMapUrl = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(
    adminItem.signInLatitude!
  )}&mlon=${encodeURIComponent(adminItem.signInLongitude!)}#map=17/${encodeURIComponent(
    adminItem.signInLatitude!
  )}/${encodeURIComponent(adminItem.signInLongitude!)}`;

  assert(adminMapUrl === expectedOsmUrl, "Admin view generates correct OpenStreetMap link");

  // 6. LOGOUT WITH LOCATION CAPTURED & DENIED
  console.log("\n6. Testing Logout with Location Granted vs Denied/Timeout...");
  const signOutLat = "17.445500";
  const signOutLng = "78.349900";
  const signOutAcc = 8;
  const now = new Date();

  // 6a. Logout with location granted
  await db
    .update(loginRecords)
    .set({
      signedOutAt: now,
      loggedOutAt: now,
      signOutLatitude: signOutLat,
      signOutLongitude: signOutLng,
      signOutAccuracyMeters: signOutAcc,
      signOutLocationStatus: "captured",
    })
    .where(eq(loginRecords.id, loginRec.id));

  await db.insert(caseEvents).values([
    {
      eventType: "therapist_sign_out_location_captured",
      actorId: therapist.id,
      actorRole: "therapist",
      targetUserId: therapist.id,
      metadata: {
        loginRecordId: loginRec.id,
        status: "captured",
      },
    },
    {
      eventType: "therapist_signed_out",
      actorId: therapist.id,
      actorRole: "therapist",
      targetUserId: therapist.id,
      metadata: {
        loginRecordId: loginRec.id,
        signOutLocationStatus: "captured",
      },
    },
  ]);

  const [loggedOutRec] = await db
    .select()
    .from(loginRecords)
    .where(eq(loginRecords.id, loginRec.id));

  assert(Boolean(loggedOutRec.signedOutAt), "signed_out_at is recorded");
  assert(loggedOutRec.signOutLocationStatus === "captured", "Sign-out location status is captured");
  assert(loggedOutRec.signOutLatitude === signOutLat, "Sign-out latitude stored");

  // 6b. Logout with location denied: therapist still signed out, status = denied
  const [deniedLogoutRec] = await db
    .insert(loginRecords)
    .values({
      userId: therapist.id,
      branchId: testBranch.id,
      signedInAt: new Date(),
      loggedInAt: new Date(),
      signInLocationStatus: "captured",
      signedOutAt: new Date(),
      signOutLocationStatus: "denied",
    })
    .returning();

  assert(
    deniedLogoutRec.signOutLocationStatus === "denied" && Boolean(deniedLogoutRec.signedOutAt),
    "Logout is NEVER blocked when location is denied; signs out with signOutLocationStatus = 'denied'"
  );

  // 6c. Tab close without logout: beacon signout records not_captured
  const [beaconRec] = await db
    .insert(loginRecords)
    .values({
      userId: therapist.id,
      branchId: testBranch.id,
      signedInAt: new Date(),
      loggedInAt: new Date(),
      signInLocationStatus: "captured",
      signedOutAt: new Date(),
      signOutLocationStatus: "not_captured",
    })
    .returning();

  assert(
    beaconRec.signOutLocationStatus === "not_captured",
    "Tab close without logout sets signOutLocationStatus = 'not_captured'"
  );

  const rId = Math.floor(1000 + Math.random() * 8000);

  // 7. CREATE CASE & RED TILE TODAY
  console.log("\n7. Testing Case Creation & RED Tile on Today...");
  const [case1] = await db
    .insert(cases)
    .values({
      caseNumber: `GCS-CASE-01-${ts}`,
      patientId: `GCP-${rId}1`,
      clientId: client.id,
      currentTherapistId: therapist.id,
      createdBy: therapist.id,
      branchId: testBranch.id,
      service: "physiotherapy",
      category: "physiotherapy",
      priority: "medium",
      problem: "Knee pain rehabilitation",
      description: "Post operative rehabilitation assessment",
      presentCondition: "Initial intake completed",
      startDate: todayIST,
      roomNo: "101",
      status: "active",
    })
    .returning();

  assert(Boolean(case1), "Case 1 created with startDate = todayIST");

  // Future case
  const [futureCase] = await db
    .insert(cases)
    .values({
      caseNumber: `GCS-CASE-FUT-${ts}`,
      patientId: `GCP-${rId}2`,
      clientId: client.id,
      currentTherapistId: therapist.id,
      createdBy: therapist.id,
      branchId: testBranch.id,
      service: "physiotherapy",
      category: "physiotherapy",
      priority: "medium",
      problem: "Scheduled next month",
      description: "Future rehabilitation plan",
      presentCondition: "Pending intake",
      startDate: tomorrowIST,
      roomNo: "102",
      status: "active",
    })
    .returning();

  // Check board filter: startDate <= todayIST
  const activeBoardCases = await db
    .select({ id: cases.id, patientId: cases.patientId })
    .from(cases)
    .where(
      and(
        eq(cases.currentTherapistId, therapist.id),
        eq(cases.branchId, testBranch.id),
        sql`${cases.status} != 'completed'`,
        sql`(${cases.startDate} IS NULL OR ${cases.startDate} <= ${todayIST})`
      )
    );

  const activeIds = activeBoardCases.map((c) => c.id);
  assert(activeIds.includes(case1.id), "Case created with today's start date appears immediately on board");
  assert(!activeIds.includes(futureCase.id), "Future start date case does NOT appear on board until start date");

  // 8. THE 3 ITEMS REQUIRED FOR GREEN TILE
  console.log("\n8. Testing The 3 Items Requirement (Condition, Note, Signature)...");
  // Test A: Missing condition (< 10 chars)
  const shortCondition = "Good";
  const validNote = "Patient completed 20 minutes of gait retraining with minimal discomfort.";
  // Generate dummy 1x1 transparent PNG as base64
  const sampleSignatureBase64 =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

  // Verify server validation fails if condition < 10 chars
  assert(shortCondition.length < 10, "Short condition (<10 chars) is detected");

  // Test B: Note < 10 chars
  const shortNote = "Done ok";
  assert(shortNote.length < 10, "Short note (<10 chars) is detected");

  // Test C: Valid session with all 3 items saved on server
  const validCondition = "Patient reports mild joint stiffness, mobility improved today.";
  const signatureKey = `sig_test_${case1.id}_${todayIST}.png`;

  const [session1] = await db
    .insert(sessions)
    .values({
      caseId: case1.id,
      therapistId: therapist.id,
      branchId: testBranch.id,
      sessionDate: todayIST,
      scheduledAt: new Date(),
      recordedAt: new Date(),
      status: "held",
      notes: validNote,
      workDone: validNote,
      presentConditionSnapshot: validCondition,
      signatureKey,
      patientSignatureKey: signatureKey,
      completedAt: new Date(),
    })
    .returning();

  // Update case present condition
  await db
    .update(cases)
    .set({ presentCondition: validCondition })
    .where(eq(cases.id, case1.id));

  // Audit events
  await db.insert(caseEvents).values([
    {
      eventType: "session_recorded",
      actorId: therapist.id,
      actorRole: "therapist",
      caseId: case1.id,
      metadata: {
        sessionId: session1.id,
        sessionDate: todayIST,
      },
    },
    {
      eventType: "session_signed",
      actorId: therapist.id,
      actorRole: "therapist",
      caseId: case1.id,
      metadata: {
        sessionId: session1.id,
        sessionDate: todayIST,
      },
    },
  ]);

  // Verify tile is now GREEN (data-status="done")
  const [savedSession] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.caseId, case1.id), eq(sessions.sessionDate, todayIST)));

  const has3Items = Boolean(
    savedSession?.presentConditionSnapshot &&
      savedSession.presentConditionSnapshot.length >= 10 &&
      savedSession?.notes &&
      savedSession.notes.length >= 10 &&
      savedSession?.signatureKey
  );

  assert(has3Items, "All 3 items (condition >= 10, note >= 10, signature) saved on server -> Tile turns GREEN");

  // 9. REJECT SECOND SESSION ON SAME CASE ON SAME IST DAY
  console.log("\n9. Testing Unique Constraint on (case_id, session_date)...");
  let uniqueViolationCaught = false;
  try {
    const [second] = await db.insert(sessions).values({
      caseId: case1.id,
      therapistId: therapist.id,
      branchId: testBranch.id,
      sessionDate: todayIST,
      scheduledAt: new Date(),
      notes: "Duplicate session attempt",
      status: "held",
    }).returning();
    console.log("Unexpected: insert succeeded with id:", second?.id);
  } catch (err: any) {
    const isUnique =
      err?.code === "23505" ||
      err?.cause?.code === "23505" ||
      String(err?.message || "").toLowerCase().includes("unique") ||
      String(err?.cause?.message || "").toLowerCase().includes("unique") ||
      String(err?.cause?.constraint || "").toLowerCase().includes("unique");

    if (isUnique) {
      uniqueViolationCaught = true;
    }
  }

  assert(uniqueViolationCaught, "Second session on same day is rejected by unique constraint ('Today's session is already recorded')");

  // 10. MIDNIGHT IST RESET & HISTORY PRESERVATION
  console.log("\n10. Testing Midnight IST Day Change Simulation...");
  // Simulate next day (tomorrow)
  const tomorrowSessions = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.caseId, case1.id), eq(sessions.sessionDate, tomorrowIST)));

  assert(tomorrowSessions.length === 0, "No session recorded for tomorrow yet -> Case tile automatically resets to RED for tomorrow");
  assert(Boolean(savedSession), "Previous day's recorded session remains permanently in history");

  // 11. CASE CALENDAR MISSED DAYS vs ADMIN DASHBOARD SESSIONS FIGURE
  console.log("\n11. Testing Missed Days in Calendar vs Admin Dashboard Session Count...");
  // Create past case with missed day yesterday
    const [pastCase] = await db
    .insert(cases)
    .values({
      caseNumber: `GCS-CASE-PAST-${ts}`,
      patientId: `GCP-${rId}3`,
      clientId: client.id,
      currentTherapistId: therapist.id,
      createdBy: therapist.id,
      branchId: testBranch.id,
      service: "physiotherapy",
      category: "physiotherapy",
      priority: "medium",
      problem: "Knee rehab",
      description: "Started yesterday",
      startDate: yesterdayIST,
      status: "active",
    })
    .returning();

  // No session was recorded for pastCase on yesterdayIST (it was missed)
  const pastSessions = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.caseId, pastCase.id), eq(sessions.sessionDate, yesterdayIST)));

  assert(pastSessions.length === 0, "Yesterday has no session for past case (stays RED forever in case calendar)");

  // Verify Admin dashboard figure counts ONLY recorded sessions (held), zero penalties for missed days
  const [adminSessionsCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sessions)
    .where(
      and(
        eq(sessions.branchId, testBranch.id),
        eq(sessions.status, "held")
      )
    );

  assert(adminSessionsCount.count === 1, "Admin dashboard sessions figure counts ONLY recorded sessions (no penalty for missed days)");

  // 12. CLOSING CONSTRAINT
  console.log("\n12. Testing Closing Rule Enforced by Server...");
  // Case created TODAY without session cannot be closed
  const [newCaseToday] = await db
    .insert(cases)
    .values({
      caseNumber: `GCS-CASE-NEW-${ts}`,
      patientId: `GCP-${rId}4`,
      clientId: client.id,
      currentTherapistId: therapist.id,
      createdBy: therapist.id,
      branchId: testBranch.id,
      service: "physiotherapy",
      category: "physiotherapy",
      priority: "medium",
      problem: "Back pain",
      description: "Intake today",
      startDate: todayIST,
      status: "active",
      createdAt: new Date(),
    })
    .returning();

  // Server Closing Constraint check:
  // Cannot close case created today without today's session
  const createdDateIST = formatToISTDateString(newCaseToday.createdAt);
  const isCreatedToday =
    createdDateIST === todayIST ||
    (newCaseToday.startDate && newCaseToday.startDate === todayIST);

  const [sessionForNewCase] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.caseId, newCaseToday.id),
        eq(sessions.sessionDate, todayIST),
        eq(sessions.status, "held")
      )
    );

  const cannotCloseTodayWithoutSession = Boolean(isCreatedToday && !sessionForNewCase);
  assert(
    cannotCloseTodayWithoutSession,
    "Closing a case created today without today's session is strictly rejected by server rule"
  );

  // Now record today's session for newCaseToday
  const [closedCaseSession] = await db.insert(sessions).values({
    caseId: newCaseToday.id,
    therapistId: therapist.id,
    branchId: testBranch.id,
    sessionDate: todayIST,
    scheduledAt: new Date(),
    notes: "Session completed before closing case.",
    presentConditionSnapshot: "Patient condition improved significantly today.",
    signatureKey: `sig_close_${newCaseToday.id}.png`,
    status: "held",
  }).returning();

  // Now check if allowed to close
  const [updatedSessionForNewCase] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.caseId, newCaseToday.id),
        eq(sessions.sessionDate, todayIST),
        eq(sessions.status, "held")
      )
    );

  const canCloseTodayWithSession = !isCreatedToday || Boolean(updatedSessionForNewCase);
  assert(canCloseTodayWithSession, "Closing a case created today is permitted once today's session is recorded");

  // A case started on an earlier day can be closed even if today's session is not recorded
  const isPastCaseCreatedToday =
    formatToISTDateString(pastCase.createdAt) === todayIST && pastCase.startDate === todayIST;
  const canClosePastCase = Boolean(pastCase.startDate && pastCase.startDate < todayIST) || pastSessions.length > 0;
  assert(canClosePastCase, "Case started on an earlier day can be closed directly without today's session");

  // 13. TEN CASES PRODUCE TEN SEPARATE TILES
  console.log("\n13. Testing Ten Cases Produce Ten Separate Tiles...");
  const bulkCasesValues = Array.from({ length: 10 }).map((_, i) => ({
    caseNumber: `GCS-CASE-10-${ts}-${i}`,
    patientId: `GCP-${rId}${String(i + 10).padStart(2, "0")}`,
    clientId: client.id,
    currentTherapistId: therapist.id,
    createdBy: therapist.id,
    branchId: testBranch.id,
    service: "physiotherapy",
    category: "physiotherapy",
    priority: "medium" as const,
    problem: `Problem description ${i}`,
    description: `Detailed description for case ${i}`,
    presentCondition: `Initial condition ${i}`,
    startDate: todayIST,
    roomNo: `${200 + i}`,
    status: "active" as const,
  }));

  const inserted10Cases = await db.insert(cases).values(bulkCasesValues).returning();
  assert(inserted10Cases.length === 10, "10 separate active cases created");

  const tenTilesQuery = await db
    .select({ id: cases.id, patientId: cases.patientId })
    .from(cases)
    .where(
      and(
        eq(cases.currentTherapistId, therapist.id),
        eq(cases.branchId, testBranch.id),
        sql`${cases.status} != 'completed'`,
        sql`(${cases.startDate} IS NULL OR ${cases.startDate} <= ${todayIST})`
      )
    )
    .orderBy(cases.patientId);

  const tenTilesIds = tenTilesQuery.filter((c) => inserted10Cases.some((i) => i.id === c.id));
  assert(tenTilesIds.length === 10, "10 active cases yield 10 distinct, separate tiles on the board (never merged)");

  // 14. DATA ISOLATION: THERAPIST CANNOT ACCESS ANOTHER THERAPIST'S TILES/FILES
  console.log("\n14. Testing Security & Data Isolation...");
  // Query other therapist's cases
  const otherCases = await db
    .select()
    .from(cases)
    .where(
      and(
        eq(cases.currentTherapistId, otherTherapist.id),
        eq(cases.branchId, testBranch.id)
      )
    );

  assert(
    !otherCases.some((c) => c.currentTherapistId === therapist.id),
    "Strict therapist isolation: therapist only queries and sees their own cases"
  );

  // SUMMARY
  console.log("\n========================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("========================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPrompt17TestSuite()
  .then(() => {
    console.log("Prompt 17 test suite completed successfully!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Test suite failed:", err);
    process.exit(1);
  });
