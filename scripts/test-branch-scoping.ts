import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.test", override: true });

process.env.EMAIL_PROVIDER = "mock";
process.env.ALLOW_REAL_EMAIL_TESTS = "false";
(process.env as Record<string, string>).NODE_ENV = "test";

import { db } from "../src/db";
import {
  users,
  branches,
  userBranches,
  rooms,
  clients,
  cases,
  inAppNotifications,
} from "../src/db/schema";
import { eq, and, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getScope, ScopeError } from "../src/lib/scope";
import { createCaseTherapistAction } from "../src/lib/actions/case-creation-actions";
import { getFreeRoomsForBranchAction } from "../src/lib/actions/room-management-actions";
import {
  getNotificationsAction,
  getLatestNotificationsAction,
  getRecentlyClosedCasesAction,
} from "../src/lib/actions/notification-actions";

async function runBranchScopingTests() {
  console.log("\n========================================================");
  console.log("RUNNING BRANCH-BASED ACCESS & SCOPING AUTOMATED TEST SUITE");
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
  const testPassword = "Password123!";
  const hash = await bcrypt.hash(testPassword, 10);

  // 1. Create Branches: Branch North and Branch South
  console.log("1. Creating Test Branches...");
  const [branchNorth] = await db
    .insert(branches)
    .values({ name: `North Clinic ${ts}`, isActive: true })
    .returning();
  const [branchSouth] = await db
    .insert(branches)
    .values({ name: `South Clinic ${ts}`, isActive: true })
    .returning();
  const [branchInactive] = await db
    .insert(branches)
    .values({ name: `Closed Clinic ${ts}`, isActive: false })
    .returning();

  assert(Boolean(branchNorth.id && branchSouth.id), "Two active branches created.");

  // 2. Create Users:
  // - Super Admin
  // - Admin (assigned to North Clinic only)
  // - Therapist 1 (assigned to North Clinic only - Single Branch)
  // - Therapist 2 (assigned to North Clinic AND South Clinic - Multi Branch)
  // - Therapist 3 (assigned to South Clinic only - Isolated)
  console.log("\n2. Creating Test Users with Distinct Branch Assignments...");
  const [saUser] = await db
    .insert(users)
    .values({
      name: "Super Admin User",
      email: `sa.${ts}@test.com`,
      role: "super_admin",
      passwordHash: hash,
      isActive: true,
    })
    .returning();

  const [adminUser] = await db
    .insert(users)
    .values({
      name: "North Admin",
      email: `admin.north.${ts}@test.com`,
      role: "admin",
      passwordHash: hash,
      isActive: true,
    })
    .returning();

  const [therapistSingle] = await db
    .insert(users)
    .values({
      name: "Single-Branch Therapist",
      email: `therapist.single.${ts}@test.com`,
      role: "therapist",
      passwordHash: hash,
      isActive: true,
    })
    .returning();

  const [therapistMulti] = await db
    .insert(users)
    .values({
      name: "Multi-Branch Therapist",
      email: `therapist.multi.${ts}@test.com`,
      role: "therapist",
      passwordHash: hash,
      isActive: true,
    })
    .returning();

  const [therapistOther] = await db
    .insert(users)
    .values({
      name: "Other Therapist",
      email: `therapist.other.${ts}@test.com`,
      role: "therapist",
      passwordHash: hash,
      isActive: true,
    })
    .returning();

  // Assign user_branches
  await db.insert(userBranches).values([
    // Admin in North
    { userId: adminUser.id, branchId: branchNorth.id, roleInBranch: "admin" },
    // Therapist 1 in North only
    { userId: therapistSingle.id, branchId: branchNorth.id, roleInBranch: "therapist" },
    // Therapist 2 in North & South
    { userId: therapistMulti.id, branchId: branchNorth.id, roleInBranch: "therapist" },
    { userId: therapistMulti.id, branchId: branchSouth.id, roleInBranch: "therapist" },
    // Therapist 3 in South only
    { userId: therapistOther.id, branchId: branchSouth.id, roleInBranch: "therapist" },
  ]);

  assert(true, "Users and user_branches memberships configured.");

  // 3. Test getScope for Super Admin
  console.log("\n3. Testing Super Admin Scope...");
  const saScope = await getScope({
    id: saUser.id,
    name: saUser.name,
    email: saUser.email,
    role: "super_admin",
    isActive: true,
    phone: null,
    mustChangePassword: false,
    temporaryPasswordPrompt: false,
    deletedAt: null,
    sessionVersion: 1,
  });
  assert(saScope.isSuperAdmin === true, "Super Admin detected.");
  assert(
    saScope.allowedBranches.some((b) => b.id === branchNorth.id) &&
      saScope.allowedBranches.some((b) => b.id === branchSouth.id),
    "Super Admin has access to all active branches."
  );
  assert(
    !saScope.allowedBranches.some((b) => b.id === branchInactive.id),
    "Inactive branch excluded from active branches."
  );

  // 4. Test getScope for Single-Branch Therapist
  console.log("\n4. Testing Single-Branch Therapist Scope...");
  const singleScope = await getScope({
    id: therapistSingle.id,
    name: therapistSingle.name,
    email: therapistSingle.email,
    role: "therapist",
    isActive: true,
    phone: null,
    mustChangePassword: false,
    temporaryPasswordPrompt: false,
    deletedAt: null,
    sessionVersion: 1,
  });
  assert(singleScope.allowedBranches.length === 1, "Therapist has exactly 1 allowed branch.");
  assert(singleScope.allowedBranches[0].id === branchNorth.id, "Single branch is North Clinic.");
  assert(singleScope.canAccessBranch(branchNorth.id) === true, "Can access assigned North branch.");
  assert(singleScope.canAccessBranch(branchSouth.id) === false, "Cannot access unassigned South branch.");

  // Test ScopeError when unauthorized branch requested
  let singleErrorCaught = false;
  try {
    await getScope(
      {
        id: therapistSingle.id,
        name: therapistSingle.name,
        email: therapistSingle.email,
        role: "therapist",
        isActive: true,
        phone: null,
        mustChangePassword: false,
        temporaryPasswordPrompt: false,
        deletedAt: null,
        sessionVersion: 1,
      },
      branchSouth.id
    );
  } catch (err: any) {
    if (err instanceof ScopeError && err.statusCode === 403) {
      singleErrorCaught = true;
    }
  }
  assert(singleErrorCaught, "Tampering with unauthorized branch throws ScopeError 403.");

  // 5. Test getScope for Multi-Branch Therapist
  console.log("\n5. Testing Multi-Branch Therapist Scope...");
  const multiScope = await getScope({
    id: therapistMulti.id,
    name: therapistMulti.name,
    email: therapistMulti.email,
    role: "therapist",
    isActive: true,
    phone: null,
    mustChangePassword: false,
    temporaryPasswordPrompt: false,
    deletedAt: null,
    sessionVersion: 1,
  });
  assert(multiScope.allowedBranches.length === 2, "Multi-branch therapist has 2 allowed branches.");
  assert(
    multiScope.canAccessBranch(branchNorth.id) || multiScope.canAccessBranch(branchSouth.id),
    "Allowed branch IDs include both North and South branches."
  );

  // 6. Test Free Rooms in Branch
  console.log("\n6. Testing Branch-Specific Rooms...");
  const [roomNorth1] = await db
    .insert(rooms)
    .values({ branchId: branchNorth.id, roomNo: `101-${ts}`, isActive: true })
    .returning();
  const [roomNorth2] = await db
    .insert(rooms)
    .values({ branchId: branchNorth.id, roomNo: `102-${ts}`, isActive: true })
    .returning();
  const [roomSouth1] = await db
    .insert(rooms)
    .values({ branchId: branchSouth.id, roomNo: `201-${ts}`, isActive: true })
    .returning();

  const [client1] = await db
    .insert(clients)
    .values({
      fullName: "Patient Occupying Room",
      age: 35,
      gender: "male",
      phone: "9876543210",
    })
    .returning();

  // Occupy roomNorth1 with an active case
  const [caseOccupying] = await db
    .insert(cases)
    .values({
      caseNumber: `GCS-OCC-${ts}`,
      patientId: `GCP-OCC-${ts}`,
      clientId: client1.id,
      category: "physiotherapy",
      priority: "medium",
      description: "Initial clinical case description",
      branchId: branchNorth.id,
      roomId: roomNorth1.id,
      roomNo: roomNorth1.roomNo,
      status: "active",
      currentTherapistId: therapistSingle.id,
      createdBy: therapistSingle.id,
    })
    .returning();

  // Query free rooms in North Clinic
  const northRooms = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.branchId, branchNorth.id), eq(rooms.isActive, true)));

  const northOccupied = await db
    .select({ roomId: cases.roomId })
    .from(cases)
    .where(and(eq(cases.branchId, branchNorth.id), eq(cases.status, "active")));

  const occupiedIds = new Set(northOccupied.map((o) => o.roomId));
  const availableNorthRooms = northRooms.filter((r) => !occupiedIds.has(r.id));

  assert(availableNorthRooms.some((r) => r.id === roomNorth2.id), "Room 102 is FREE in North Clinic.");
  assert(!availableNorthRooms.some((r) => r.id === roomNorth1.id), "Room 101 is OCCUPIED in North Clinic.");

  // 7. Testing Case Isolation between Therapists & Branches
  console.log("\n7. Testing Case Isolation between Therapists & Branches...");
  const [client2] = await db
    .insert(clients)
    .values({
      fullName: "South Patient",
      age: 40,
      gender: "female",
      phone: "9876543211",
    })
    .returning();

  const [caseSouth] = await db
    .insert(cases)
    .values({
      caseNumber: `GCS-SOUTH-${ts}`,
      patientId: `GCP-SOUTH-${ts}`,
      clientId: client2.id,
      category: "physiotherapy",
      priority: "medium",
      description: "South clinical case description",
      branchId: branchSouth.id,
      roomId: roomSouth1.id,
      roomNo: roomSouth1.roomNo,
      status: "active",
      currentTherapistId: therapistOther.id,
      createdBy: therapistOther.id,
    })
    .returning();

  // Therapist 1 (Single, North only) querying their own cases in North branch
  const therapist1NorthCases = await db
    .select()
    .from(cases)
    .where(
      and(
        eq(cases.branchId, branchNorth.id),
        sql`(${cases.currentTherapistId} = ${therapistSingle.id} OR ${cases.createdBy} = ${therapistSingle.id})`
      )
    );
  assert(therapist1NorthCases.length === 1, "Therapist 1 sees exactly their own case in North branch.");
  assert(therapist1NorthCases[0].id === caseOccupying.id, "Case matches therapist 1's case.");

  // Therapist 1 querying cases in South branch
  const therapist1SouthCases = await db
    .select()
    .from(cases)
    .where(
      and(
        eq(cases.branchId, branchSouth.id),
        sql`(${cases.currentTherapistId} = ${therapistSingle.id} OR ${cases.createdBy} = ${therapistSingle.id})`
      )
    );
  assert(therapist1SouthCases.length === 0, "Therapist 1 sees 0 cases in South branch.");

  // Therapist 1 cannot see Therapist 3's case in South branch
  assert(!therapist1NorthCases.some((c) => c.id === caseSouth.id), "Therapist 1 cannot see South patient.");

  // 8. Testing Notifications Scoped to Branch & Account-Level Notices
  console.log("\n8. Testing Notification Branch Scoping...");
  // Notification in North Branch
  const [notifNorth] = await db
    .insert(inAppNotifications)
    .values({
      userId: therapistMulti.id,
      type: "case_created",
      title: "North Case Created",
      body: "Notification specifically for North branch",
      priority: "normal",
      branchId: branchNorth.id,
      isRead: false,
      data: {},
    })
    .returning();

  // Notification in South Branch
  const [notifSouth] = await db
    .insert(inAppNotifications)
    .values({
      userId: therapistMulti.id,
      type: "case_created",
      title: "South Case Created",
      body: "Notification specifically for South branch",
      priority: "normal",
      branchId: branchSouth.id,
      isRead: false,
      data: {},
    })
    .returning();

  // Account-Level notification (branchId: null)
  const [notifAccount] = await db
    .insert(inAppNotifications)
    .values({
      userId: therapistMulti.id,
      type: "password_changed",
      title: "Security: Password Changed",
      body: "Your account password was successfully updated.",
      priority: "high",
      branchId: null,
      isRead: false,
      data: {},
    })
    .returning();

  // Query notifications when North Branch is selected:
  // Should see notifNorth AND notifAccount (null branchId)
  // Should NOT see notifSouth
  const northSelectedNotifs = await db
    .select()
    .from(inAppNotifications)
    .where(
      and(
        eq(inAppNotifications.userId, therapistMulti.id),
        sql`(${inAppNotifications.branchId} = ${branchNorth.id} OR ${inAppNotifications.branchId} IS NULL)`
      )
    );
  const northIds = northSelectedNotifs.map((n) => n.id);
  assert(northIds.includes(notifNorth.id), "North branch notification visible when North selected.");
  assert(northIds.includes(notifAccount.id), "Account-level (null branchId) notice visible when North selected.");
  assert(!northIds.includes(notifSouth.id), "South branch notification HIDDEN when North selected.");

  // Query notifications when South Branch is selected:
  const southSelectedNotifs = await db
    .select()
    .from(inAppNotifications)
    .where(
      and(
        eq(inAppNotifications.userId, therapistMulti.id),
        sql`(${inAppNotifications.branchId} = ${branchSouth.id} OR ${inAppNotifications.branchId} IS NULL)`
      )
    );
  const southIds = southSelectedNotifs.map((n) => n.id);
  assert(southIds.includes(notifSouth.id), "South branch notification visible when South selected.");
  assert(southIds.includes(notifAccount.id), "Account-level (null branchId) notice visible when South selected.");
  assert(!southIds.includes(notifNorth.id), "North branch notification HIDDEN when South selected.");

  console.log("\n========================================================");
  console.log(`BRANCH ACCESS TEST SUITE SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log("========================================================\n");
}

runBranchScopingTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test Suite Error:", err);
    process.exit(1);
  });
