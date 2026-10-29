import { db } from "@/db";
import {
  users,
  cases,
  sessions,
  rooms,
  loginRecords,
  userBranches,
  type User,
} from "@/db/schema";
import { eq, and, ne, sql, desc, isNull, inArray } from "drizzle-orm";
import { type DateFilterRange, formatDateTimeIST } from "@/lib/date-utils";

export interface AdminTherapistRow {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  sessionsOnDate: number;
  activeCases: number;
  closedOnDate: number;
  roomsInUse: number;
  lastLogin: string; // "26 Oct 2026, 10:15 AM" or "Never"
  rawLastLoginDate: Date | null;
}

export interface AdminDashboardData {
  stats: {
    activeTherapists: number;
    activeCases: number;
    sessionsOnDate: number;
    roomsFree: number;
    roomsTotal: number;
  };
  therapists: AdminTherapistRow[];
  nullRoomCasesCount: number;
  filter: DateFilterRange;
}

export async function getAdminSimplifiedDashboardData(
  filter: DateFilterRange,
  branchId?: string | null
): Promise<AdminDashboardData> {
  const selectedDate = filter.startDate;
  const isPast = filter.isPast;

  // 1. Therapists list (role = 'therapist' and not deleted, scoped to branch if branchId provided)
  const therapistList = branchId
    ? await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          isActive: users.isActive,
        })
        .from(userBranches)
        .innerJoin(users, eq(users.id, userBranches.userId))
        .where(
          and(
            eq(userBranches.branchId, branchId),
            isNull(userBranches.removedAt),
            eq(users.role, "therapist"),
            isNull(users.deletedAt)
          )
        )
        .orderBy(users.name)
    : await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          isActive: users.isActive,
        })
        .from(users)
        .where(and(eq(users.role, "therapist"), isNull(users.deletedAt)))
        .orderBy(users.name);

  const activeTherapistsCount = therapistList.filter((t) => t.isActive).length;

  // 2. Active cases count:
  // If viewing today: cases where status <> 'completed'
  // If viewing past date: cases created on/before selectedDate AND (closedAt is null or closedAt > selectedDate)
  let activeCasesCount = 0;
  if (!isPast) {
    const conditions = [ne(cases.status, "completed")];
    if (branchId) conditions.push(eq(cases.branchId, branchId));
    const [openCasesRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cases)
      .where(and(...conditions));
    activeCasesCount = openCasesRes?.count ?? 0;
  } else {
    const branchSql = branchId ? sql`AND "branch_id" = ${branchId}::uuid` : sql``;
    const [historicalActiveRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cases)
      .where(
        sql`date("created_at" AT TIME ZONE 'Asia/Kolkata') <= ${selectedDate}::date
          AND ("closed_at" IS NULL OR date("closed_at" AT TIME ZONE 'Asia/Kolkata') > ${selectedDate}::date)
          ${branchSql}`
      );
    activeCasesCount = historicalActiveRes?.count ?? 0;
  }

  // 3. Sessions on selected date
  const sessionConditions = [eq(sessions.sessionDate, selectedDate)];
  if (branchId) sessionConditions.push(eq(sessions.branchId, branchId));
  const [sessionsRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sessions)
    .where(and(...sessionConditions));
  const sessionsOnDate = sessionsRes?.count ?? 0;

  // 4. Rooms (free / total)
  // Total active rooms scoped to branch if branchId provided
  const roomConditions = [eq(rooms.isActive, true)];
  if (branchId) roomConditions.push(eq(rooms.branchId, branchId));
  const [totalRoomsRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rooms)
    .where(and(...roomConditions));
  const roomsTotal = totalRoomsRes?.count ?? 0;

  // Currently occupied rooms (pointed to by an open case)
  const occConditions = [
    ne(cases.status, "completed"),
    sql`${cases.roomId} IS NOT NULL`,
  ];
  if (branchId) occConditions.push(eq(cases.branchId, branchId));
  const [occupiedRoomsRes] = await db
    .select({ count: sql<number>`count(DISTINCT ${cases.roomId})::int` })
    .from(cases)
    .where(and(...occConditions));
  const roomsOccupied = occupiedRoomsRes?.count ?? 0;
  const roomsFree = Math.max(0, roomsTotal - roomsOccupied);

  // 5. Open cases with no room assigned
  const nullConditions = [
    ne(cases.status, "completed"),
    isNull(cases.roomId),
  ];
  if (branchId) nullConditions.push(eq(cases.branchId, branchId));
  const [nullRoomsRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(cases)
    .where(and(...nullConditions));
  const nullRoomCasesCount = nullRoomsRes?.count ?? 0;

  // 6. Build Therapist Table Data
  // Sessions on date per therapist
  const therapistSessionConds = [eq(sessions.sessionDate, selectedDate)];
  if (branchId) therapistSessionConds.push(eq(sessions.branchId, branchId));
  const sessionsPerTherapist = await db
    .select({
      therapistId: sessions.therapistId,
      count: sql<number>`count(*)::int`,
    })
    .from(sessions)
    .where(and(...therapistSessionConds))
    .groupBy(sessions.therapistId);
  const sessionsMap = new Map<string, number>();
  sessionsPerTherapist.forEach((s) => sessionsMap.set(s.therapistId, s.count));

  // Active cases per therapist
  let activeCasesPerTherapistMap = new Map<string, number>();
  if (!isPast) {
    const actConds = [
      ne(cases.status, "completed"),
      sql`${cases.currentTherapistId} IS NOT NULL`,
    ];
    if (branchId) actConds.push(eq(cases.branchId, branchId));
    const activePerTherapist = await db
      .select({
        therapistId: cases.currentTherapistId,
        count: sql<number>`count(*)::int`,
      })
      .from(cases)
      .where(and(...actConds))
      .groupBy(cases.currentTherapistId);
    activePerTherapist.forEach((a) => {
      if (a.therapistId) activeCasesPerTherapistMap.set(a.therapistId, a.count);
    });
  } else {
    const branchSql = branchId ? sql`AND "branch_id" = ${branchId}::uuid` : sql``;
    const historicalPerTherapist = await db
      .select({
        therapistId: cases.currentTherapistId,
        count: sql<number>`count(*)::int`,
      })
      .from(cases)
      .where(
        sql`date("created_at" AT TIME ZONE 'Asia/Kolkata') <= ${selectedDate}::date
          AND ("closed_at" IS NULL OR date("closed_at" AT TIME ZONE 'Asia/Kolkata') > ${selectedDate}::date)
          AND "current_therapist_id" IS NOT NULL
          ${branchSql}`
      )
      .groupBy(cases.currentTherapistId);
    historicalPerTherapist.forEach((a) => {
      if (a.therapistId) activeCasesPerTherapistMap.set(a.therapistId, a.count);
    });
  }

  // Cases closed on selected date per therapist
  const closedConds = [
    sql`date(${cases.closedAt} AT TIME ZONE 'Asia/Kolkata') = ${selectedDate}::date`,
    sql`${cases.currentTherapistId} IS NOT NULL`,
  ];
  if (branchId) closedConds.push(eq(cases.branchId, branchId));
  const closedOnDatePerTherapist = await db
    .select({
      therapistId: cases.currentTherapistId,
      count: sql<number>`count(*)::int`,
    })
    .from(cases)
    .where(and(...closedConds))
    .groupBy(cases.currentTherapistId);
  const closedOnDateMap = new Map<string, number>();
  closedOnDatePerTherapist.forEach((c) => {
    if (c.therapistId) closedOnDateMap.set(c.therapistId, c.count);
  });

  // Rooms in use per therapist (count of open cases with roomId)
  const roomUseConds = [
    ne(cases.status, "completed"),
    sql`${cases.roomId} IS NOT NULL`,
    sql`${cases.currentTherapistId} IS NOT NULL`,
  ];
  if (branchId) roomUseConds.push(eq(cases.branchId, branchId));
  const roomsInUsePerTherapist = await db
    .select({
      therapistId: cases.currentTherapistId,
      count: sql<number>`count(DISTINCT ${cases.roomId})::int`,
    })
    .from(cases)
    .where(and(...roomUseConds))
    .groupBy(cases.currentTherapistId);
  const roomsInUseMap = new Map<string, number>();
  roomsInUsePerTherapist.forEach((r) => {
    if (r.therapistId) roomsInUseMap.set(r.therapistId, r.count);
  });

  // Last login per therapist from login_records
  const therapistIds = therapistList.map((t) => t.id);
  const lastLoginsMap = new Map<string, Date>();
  if (therapistIds.length > 0) {
    const loginRows = await db
      .select({
        userId: loginRecords.userId,
        lastLogin: sql<Date>`max(${loginRecords.loggedInAt})`,
      })
      .from(loginRecords)
      .where(inArray(loginRecords.userId, therapistIds))
      .groupBy(loginRecords.userId);

    loginRows.forEach((l) => {
      if (l.lastLogin) lastLoginsMap.set(l.userId, new Date(l.lastLogin));
    });
  }

  const rows: AdminTherapistRow[] = therapistList.map((t) => {
    const rawLogin = lastLoginsMap.get(t.id) || null;
    return {
      id: t.id,
      name: t.name,
      email: t.email,
      isActive: t.isActive,
      sessionsOnDate: sessionsMap.get(t.id) || 0,
      activeCases: activeCasesPerTherapistMap.get(t.id) || 0,
      closedOnDate: closedOnDateMap.get(t.id) || 0,
      roomsInUse: roomsInUseMap.get(t.id) || 0,
      lastLogin: rawLogin ? formatDateTimeIST(rawLogin) : "Never",
      rawLastLoginDate: rawLogin,
    };
  });

  // Default sort: sessions descending, then name ascending
  rows.sort((a, b) => {
    if (b.sessionsOnDate !== a.sessionsOnDate) {
      return b.sessionsOnDate - a.sessionsOnDate;
    }
    return a.name.localeCompare(b.name);
  });

  return {
    stats: {
      activeTherapists: activeTherapistsCount,
      activeCases: activeCasesCount,
      sessionsOnDate,
      roomsFree,
      roomsTotal,
    },
    therapists: rows,
    nullRoomCasesCount,
    filter,
  };
}
