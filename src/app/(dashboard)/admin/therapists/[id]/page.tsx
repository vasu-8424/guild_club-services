import { notFound } from "next/navigation";
import { eq, and, ne, sql, desc, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  therapistProfiles,
  cases,
  clients,
  branches,
  rooms,
  sessions,
  loginRecords,
  adminNotes,
} from "@/db/schema";
import { requireRole } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getTherapistLoginHistoryAction } from "@/lib/actions/location-actions";
import { getAdminSentNotesAction } from "@/lib/actions/admin-notes-actions";
import {
  TherapistDetailClient,
  type DaySessionMetric,
  type TherapistActiveCaseItem,
} from "./therapist-detail-client";
import { formatDateTimeIST, getTodayIST } from "@/lib/date-utils";

interface TherapistDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ month?: string }>;
}

export default async function TherapistDetailPage({
  params,
  searchParams,
}: TherapistDetailPageProps) {
  const currentUser = await requireRole("admin", "super_admin");
  const { id } = await params;
  const rawParams = searchParams ? await searchParams : {};

  // 1. Fetch Therapist info
  const [therapist] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      isActive: users.isActive,
      specialization: therapistProfiles.specialization,
      experienceYears: therapistProfiles.experienceYears,
      maxOpenCases: therapistProfiles.maxOpenCases,
    })
    .from(users)
    .innerJoin(therapistProfiles, eq(users.id, therapistProfiles.userId))
    .where(eq(users.id, id))
    .limit(1);

  if (!therapist) {
    notFound();
  }

  // 2. Fetch last login
  const [lastLoginRow] = await db
    .select({ loggedInAt: loginRecords.loggedInAt })
    .from(loginRecords)
    .where(eq(loginRecords.userId, id))
    .orderBy(desc(loginRecords.loggedInAt))
    .limit(1);

  const lastLogin = lastLoginRow?.loggedInAt
    ? formatDateTimeIST(lastLoginRow.loggedInAt)
    : "Never";

  // 3. Month selection setup (format: YYYY-MM)
  const todayIST = getTodayIST();
  const [currentYearStr, currentMonthStr] = todayIST.split("-");
  const defaultMonth = `${currentYearStr}-${currentMonthStr}`;
  const selectedMonth = rawParams.month && /^\d{4}-\d{2}$/.test(rawParams.month)
    ? rawParams.month
    : defaultMonth;

  // Generate 6 months dropdown options
  const monthOptions: Array<{ value: string; label: string }> = [];
  const currentYear = parseInt(currentYearStr, 10);
  const currentMonthNum = parseInt(currentMonthStr, 10);

  for (let i = 0; i < 6; i++) {
    const d = new Date(Date.UTC(currentYear, currentMonthNum - 1 - i, 1));
    const val = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString("en-US", {
      timeZone: "UTC",
      month: "long",
      year: "numeric",
    });
    monthOptions.push({ value: val, label });
  }

  // Determine date range for the selected month
  const [selYear, selMonth] = selectedMonth.split("-").map(Number);
  const daysInMonth = new Date(selYear, selMonth, 0).getDate();
  const startDateStr = `${selectedMonth}-01`;
  const endDateStr = `${selectedMonth}-${String(daysInMonth).padStart(2, "0")}`;

  // 4. Fetch daily sessions, cases closed, and new cases for this month
  const [sessionRows, closedCaseRows, newCaseRows] = await Promise.all([
    db
      .select({
        sessionDate: sessions.sessionDate,
        count: sql<number>`count(*)::int`,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.therapistId, id),
          gte(sessions.sessionDate, startDateStr),
          lte(sessions.sessionDate, endDateStr)
        )
      )
      .groupBy(sessions.sessionDate),

    db
      .select({
        closedDate: sql<string>`date(${cases.closedAt} AT TIME ZONE 'Asia/Kolkata')::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(cases)
      .where(
        and(
          eq(cases.currentTherapistId, id),
          sql`date(${cases.closedAt} AT TIME ZONE 'Asia/Kolkata') >= ${startDateStr}::date`,
          sql`date(${cases.closedAt} AT TIME ZONE 'Asia/Kolkata') <= ${endDateStr}::date`
        )
      )
      .groupBy(sql`date(${cases.closedAt} AT TIME ZONE 'Asia/Kolkata')`),

    db
      .select({
        createdDate: sql<string>`date(${cases.createdAt} AT TIME ZONE 'Asia/Kolkata')::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(cases)
      .where(
        and(
          eq(cases.currentTherapistId, id),
          sql`date(${cases.createdAt} AT TIME ZONE 'Asia/Kolkata') >= ${startDateStr}::date`,
          sql`date(${cases.createdAt} AT TIME ZONE 'Asia/Kolkata') <= ${endDateStr}::date`
        )
      )
      .groupBy(sql`date(${cases.createdAt} AT TIME ZONE 'Asia/Kolkata')`),
  ]);

  const sessionsMap = new Map<string, number>();
  sessionRows.forEach((r) => {
    if (r.sessionDate) sessionsMap.set(String(r.sessionDate), r.count);
  });

  const closedMap = new Map<string, number>();
  closedCaseRows.forEach((r) => {
    if (r.closedDate) closedMap.set(r.closedDate, r.count);
  });

  const newCasesMap = new Map<string, number>();
  newCaseRows.forEach((r) => {
    if (r.createdDate) newCasesMap.set(r.createdDate, r.count);
  });

  // Assemble days for month (newest first)
  const dailyMetrics: DaySessionMetric[] = [];
  for (let day = daysInMonth; day >= 1; day--) {
    const dayStr = `${selectedMonth}-${String(day).padStart(2, "0")}`;
    const dateObj = new Date(`${dayStr}T12:00:00Z`);
    const formattedDate = dateObj.toLocaleDateString("en-US", {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
      weekday: "short",
    });

    dailyMetrics.push({
      dateStr: dayStr,
      formattedDate: `${dayStr} (${formattedDate.split(",")[0]})`,
      sessionsDone: sessionsMap.get(dayStr) || 0,
      casesClosed: closedMap.get(dayStr) || 0,
      newCases: newCasesMap.get(dayStr) || 0,
    });
  }

  // 5. Fetch Active cases for this therapist
  const activeCaseRows = await db
    .select({
      id: cases.id,
      caseNumber: cases.caseNumber,
      patientId: cases.patientId,
      clientName: clients.fullName,
      service: cases.service,
      branchName: branches.name,
      roomNo: rooms.roomNo,
      fallbackRoomNo: cases.roomNo,
      startDate: cases.startDate,
      createdAt: cases.createdAt,
    })
    .from(cases)
    .innerJoin(clients, eq(cases.clientId, clients.id))
    .leftJoin(branches, eq(cases.branchId, branches.id))
    .leftJoin(rooms, eq(cases.roomId, rooms.id))
    .where(
      and(
        eq(cases.currentTherapistId, id),
        ne(cases.status, "completed")
      )
    )
    .orderBy(desc(cases.createdAt));

  // Sessions stats per active case
  const activeCaseIds = activeCaseRows.map((c) => c.id);
  const caseSessionStatsMap = new Map<
    string,
    { count: number; lastDate: string | null }
  >();

  if (activeCaseIds.length > 0) {
    const statsRows = await db
      .select({
        caseId: sessions.caseId,
        count: sql<number>`count(*)::int`,
        lastSessionDate: sql<string>`max(${sessions.sessionDate})::text`,
      })
      .from(sessions)
      .where(sql`${sessions.caseId} IN ${activeCaseIds}`)
      .groupBy(sessions.caseId);

    statsRows.forEach((s) => {
      caseSessionStatsMap.set(s.caseId, {
        count: s.count,
        lastDate: s.lastSessionDate || null,
      });
    });
  }

  const activeCasesList: TherapistActiveCaseItem[] = activeCaseRows.map((c) => {
    const stats = caseSessionStatsMap.get(c.id);
    return {
      id: c.id,
      caseNumber: c.caseNumber,
      patientId: c.patientId || "N/A",
      patientName: c.clientName,
      service: c.service || "physiotherapy",
      branchName: c.branchName || "Unassigned",
      roomNo: c.roomNo || c.fallbackRoomNo || "—",
      startDate: c.startDate ? String(c.startDate) : "—",
      sessionsDone: stats?.count ?? 0,
      lastSessionDate: stats?.lastDate ?? "—",
    };
  });

  // 6. Fetch Notes sent to this therapist
  const notesRes = await getAdminSentNotesAction(id);
  const notesSent = notesRes.success && notesRes.data ? notesRes.data : [];

  // 7. Fetch login history
  const loginRes = await getTherapistLoginHistoryAction(id);
  const loginHistory = loginRes.success && loginRes.records ? loginRes.records : [];

  return (
    <DashboardShell user={currentUser} title={therapist.name}>
      <TherapistDetailClient
        therapist={{
          id: therapist.id,
          name: therapist.name,
          email: therapist.email,
          phone: therapist.phone,
          isActive: therapist.isActive,
          lastLogin,
        }}
        dailyMetrics={dailyMetrics}
        activeCases={activeCasesList}
        notesSent={notesSent}
        loginRecords={loginHistory}
        monthOptions={monthOptions}
        currentMonth={selectedMonth}
      />
    </DashboardShell>
  );
}
