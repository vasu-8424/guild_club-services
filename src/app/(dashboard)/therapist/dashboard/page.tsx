import { requireRole } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { db } from "@/db";
import { sessions, cases, clients, therapistRoomAssignments } from "@/db/schema";
import { eq, and, sql, asc } from "drizzle-orm";
import { parseDateFilter } from "@/lib/date-utils";
import { TherapistDashboardClient } from "./therapist-dashboard-client";

interface TherapistDashboardPageProps {
  searchParams?: Promise<{
    date?: string | string[];
    from?: string | string[];
    to?: string | string[];
  }>;
}

export default async function TherapistDashboard({
  searchParams,
}: TherapistDashboardPageProps) {
  const user = await requireRole("therapist");
  const rawParams = searchParams ? await searchParams : {};
  const filter = parseDateFilter(rawParams);

  // 1. Fetch assigned room for the selected date
  const [roomAssignment] = await db
    .select({ roomNo: therapistRoomAssignments.roomNo })
    .from(therapistRoomAssignments)
    .where(
      and(
        eq(therapistRoomAssignments.therapistId, user.id),
        eq(therapistRoomAssignments.assignedDate, filter.startDate)
      )
    )
    .limit(1);

  // 2. Fetch sessions for the selected date, ordered by scheduled time
  const dateSessions = await db
    .select({
      id: sessions.id,
      caseId: sessions.caseId,
      scheduledAt: sessions.scheduledAt,
      status: sessions.status,
      notes: sessions.notes,
      inTimeAt: sessions.inTimeAt,
      inTimePhotoKey: sessions.inTimePhotoKey,
      outTimeAt: sessions.outTimeAt,
      outTimePhotoKey: sessions.outTimePhotoKey,
      workDone: sessions.workDone,
      patientSignatureKey: sessions.patientSignatureKey,
      photoConsent: sessions.photoConsent,
      completedAt: sessions.completedAt,
      caseNumber: cases.caseNumber,
      patientName: clients.fullName,
      patientAge: clients.age,
    })
    .from(sessions)
    .innerJoin(cases, eq(sessions.caseId, cases.id))
    .innerJoin(clients, eq(cases.clientId, clients.id))
    .where(
      and(
        eq(sessions.therapistId, user.id),
        sql`${sessions.scheduledAt} >= (${filter.startDate}::date)::timestamp AT TIME ZONE 'Asia/Kolkata'`,
        sql`${sessions.scheduledAt} < ((${filter.startDate}::date + 1))::timestamp AT TIME ZONE 'Asia/Kolkata'`
      )
    )
    .orderBy(asc(sessions.scheduledAt));

  // 3. Fetch count of active open cases assigned to this therapist
  const [openCasesResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(cases)
    .where(
      and(
        eq(cases.currentTherapistId, user.id),
        sql`${cases.status} IN ('assigned', 'accepted', 'in_progress', 'on_hold')`
      )
    );
  const openCasesCount = openCasesResult?.count ?? 0;

  // 4. Fetch the next upcoming session date if one exists in the future
  const [nextSession] = await db
    .select({
      scheduledAt: sessions.scheduledAt,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.therapistId, user.id),
        sql`${sessions.scheduledAt} >= ((${filter.startDate}::date + 1))::timestamp AT TIME ZONE 'Asia/Kolkata'`
      )
    )
    .orderBy(asc(sessions.scheduledAt))
    .limit(1);

  // 5. Fetch any pending case invitations for this therapist
  const pendingInvitations = await db
    .select({
      id: cases.id,
      caseNumber: cases.caseNumber,
      clientName: clients.fullName,
      priority: cases.priority,
      category: cases.category,
    })
    .from(cases)
    .innerJoin(clients, eq(cases.clientId, clients.id))
    .where(
      and(
        eq(cases.currentTherapistId, user.id),
        eq(cases.status, "assigned")
      )
    );

  return (
    <DashboardShell user={user} title="Session Board">
      <TherapistDashboardClient
        user={user}
        initialSessions={dateSessions}
        roomNo={roomAssignment?.roomNo || null}
        selectedDate={filter.startDate}
        isToday={filter.isToday}
        isPast={filter.isPast}
        pendingInvitations={pendingInvitations}
        openCasesCount={openCasesCount}
        nextUpcomingSessionDate={nextSession?.scheduledAt ? nextSession.scheduledAt.toISOString() : null}
      />
    </DashboardShell>
  );
}
