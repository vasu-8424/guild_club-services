import { requireRole } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { db } from "@/db";
import { cases, clients, users } from "@/db/schema";
import { eq, and, isNotNull, sql, desc } from "drizzle-orm";
import { getTodayIST, formatDateTimeIST, formatTimeIST } from "@/lib/date-utils";
import { getScope } from "@/lib/scope";
import { BranchPickerCard } from "@/components/layout/branch-picker-card";
import { type ClosedCaseItem } from "@/components/dashboard/recently-closed-cases-card";
import { SuperAdminDashboardClient } from "./super-admin-dashboard-client";

interface SuperAdminDashboardPageProps {
  searchParams?: Promise<{
    date?: string | string[];
    from?: string | string[];
    to?: string | string[];
    branch?: string;
  }>;
}

export default async function SuperAdminDashboard({
  searchParams,
}: SuperAdminDashboardPageProps) {
  const user = await requireRole("super_admin");
  const rawParams = searchParams ? await searchParams : {};
  const branchParam = typeof rawParams.branch === "string" ? rawParams.branch : undefined;

  const scope = await getScope(user, branchParam);

  // If Super Admin hasn't selected a branch, show the branch picker card
  if (!scope.hasSelectedBranch || !scope.activeBranchId) {
    return (
      <DashboardShell user={user} title="Super Administrator Portal">
        <BranchPickerCard
          branches={scope.allowedBranches}
          title="Select a Branch to View Analytics"
          description="Super Administrator views data by picking a branch first. Choose an active branch to explore metrics, activity logs, and case trends."
        />
      </DashboardShell>
    );
  }

  const activeBranchId = scope.activeBranchId;
  const selectedBranch = scope.allowedBranches.find((b) => b.id === activeBranchId);

  // Date selection (default today IST)
  const todayIST = getTodayIST();
  const rawDate = Array.isArray(rawParams.date) ? rawParams.date[0] : rawParams.date;
  const selectedDate =
    rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayIST;
  const isToday = selectedDate === todayIST;
  const isPast = selectedDate < todayIST;

  // Query closed cases for activeBranchId on selectedDate with IST day boundaries
  const dayStart = sql`(${selectedDate}::date)::timestamp AT TIME ZONE 'Asia/Kolkata'`;
  const dayEnd = sql`(${selectedDate}::date + interval '1 day')::timestamp AT TIME ZONE 'Asia/Kolkata'`;

  const rows = await db
    .select({
      id: cases.id,
      caseNumber: cases.caseNumber,
      patientId: sql<string>`COALESCE(${cases.patientId}, ${cases.caseNumber})`,
      patientName: clients.fullName,
      outcome: cases.outcome,
      closedAt: cases.closedAt,
      therapistName: users.name,
    })
    .from(cases)
    .leftJoin(clients, eq(cases.clientId, clients.id))
    .leftJoin(users, eq(cases.currentTherapistId, users.id))
    .where(
      and(
        eq(cases.status, "completed"),
        eq(cases.branchId, activeBranchId),
        isNotNull(cases.closedAt),
        sql`${cases.closedAt} >= ${dayStart}`,
        sql`${cases.closedAt} < ${dayEnd}`
      )
    )
    .orderBy(desc(cases.closedAt));

  const recentlyClosedCases: ClosedCaseItem[] = rows.map((r) => ({
    id: r.id,
    caseNumber: r.caseNumber,
    patientId: r.patientId,
    patientName: r.patientName || "Patient",
    therapistName: r.therapistName || "Assigned Therapist",
    outcome: r.outcome || "successful",
    closedAt: r.closedAt ? r.closedAt.toISOString() : null,
    closedAtIst: r.closedAt ? formatDateTimeIST(r.closedAt) : null,
    closedTime: r.closedAt ? formatTimeIST(r.closedAt) : null,
  }));

  return (
    <DashboardShell user={user} title="Super Administrator Portal">
      <SuperAdminDashboardClient
        user={user}
        selectedDate={selectedDate}
        isPast={isPast}
        isToday={isToday}
        branchName={selectedBranch?.name || "Clinic Branch"}
        recentlyClosedCases={recentlyClosedCases}
      />
    </DashboardShell>
  );
}
