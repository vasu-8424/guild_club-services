import { requireRole } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { db } from "@/db";
import { users, cases, userBranches } from "@/db/schema";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { parseDateFilter } from "@/lib/date-utils";
import { getScope } from "@/lib/scope";
import { BranchPickerCard } from "@/components/layout/branch-picker-card";
import {
  getDashboardSummary,
  getPeopleSummary,
  getCaseMovements,
  getActivityHeatmapData,
  getPipelineFunnelData,
  getDailyTrendData,
  getTherapistCapacityList,
  getAdminProductivityList,
} from "@/lib/dashboard";
import { getRecentlyClosedCasesAction } from "@/lib/actions/notification-actions";
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
  const filter = parseDateFilter(rawParams);
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

  // 1. Fetch core summaries and chart datasets in parallel, scoped to selected branch
  const [
    summary,
    people,
    movements,
    adminsCount,
    therapistsCount,
    activeCasesCount,
    totalCasesCount,
    heatmapData,
    pipelineData,
    trendData,
    therapistCapacity,
    adminProductivity,
    recentlyClosedRes,
  ] = await Promise.all([
    getDashboardSummary(user, filter),
    getPeopleSummary(user, filter),
    getCaseMovements(user, filter),
    db
      .select({ count: sql<number>`count(DISTINCT ${userBranches.userId})::int` })
      .from(userBranches)
      .innerJoin(users, eq(users.id, userBranches.userId))
      .where(
        and(
          eq(userBranches.branchId, activeBranchId),
          isNull(userBranches.removedAt),
          eq(users.role, "admin"),
          isNull(users.deletedAt)
        )
      ),
    db
      .select({ count: sql<number>`count(DISTINCT ${userBranches.userId})::int` })
      .from(userBranches)
      .innerJoin(users, eq(users.id, userBranches.userId))
      .where(
        and(
          eq(userBranches.branchId, activeBranchId),
          isNull(userBranches.removedAt),
          eq(users.role, "therapist"),
          isNull(users.deletedAt)
        )
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(cases)
      .where(
        and(
          eq(cases.branchId, activeBranchId),
          inArray(cases.status, ["assigned", "accepted", "in_progress"])
        )
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(cases)
      .where(eq(cases.branchId, activeBranchId)),
    getActivityHeatmapData(filter.endDate),
    getPipelineFunnelData(filter),
    getDailyTrendData(filter),
    getTherapistCapacityList(),
    getAdminProductivityList(filter),
    getRecentlyClosedCasesAction(5),
  ]);

  // 2. Status breakdown for charts scoped to branch
  const statusRows = await db
    .select({
      status: cases.status,
      count: sql<number>`count(*)::int`,
    })
    .from(cases)
    .where(eq(cases.branchId, activeBranchId))
    .groupBy(cases.status);

  const statusLabelMap: Record<string, string> = {
    new: "New",
    assigned: "Assigned",
    accepted: "Accepted",
    in_progress: "In Progress",
    on_hold: "On Hold",
    completed: "Completed",
  };

  const statusData = statusRows.map((r) => ({
    name: statusLabelMap[r.status] || r.status,
    value: r.count,
  }));

  // 3. Category breakdown for charts scoped to branch
  const categoryRows = await db
    .select({
      category: cases.category,
      count: sql<number>`count(*)::int`,
    })
    .from(cases)
    .where(eq(cases.branchId, activeBranchId))
    .groupBy(cases.category)
    .orderBy(sql`count(*) DESC`)
    .limit(6);

  const categoryData = categoryRows.map((r) => ({
    name: r.category,
    value: r.count,
  }));

  const recentlyClosedCases = recentlyClosedRes?.data || [];

  return (
    <DashboardShell user={user} title="Super Administrator Portal">
      <SuperAdminDashboardClient
        user={user}
        summary={summary}
        people={people}
        movements={movements}
        statusData={statusData}
        categoryData={categoryData}
        adminsCount={adminsCount[0]?.count ?? 0}
        therapistsCount={therapistsCount[0]?.count ?? 0}
        activeCasesCount={activeCasesCount[0]?.count ?? 0}
        totalCasesCount={totalCasesCount[0]?.count ?? 0}
        heatmapData={heatmapData}
        pipelineData={pipelineData}
        trendData={trendData}
        therapistCapacity={therapistCapacity}
        adminProductivity={adminProductivity}
        recentlyClosedCases={recentlyClosedCases}
      />
    </DashboardShell>
  );
}
