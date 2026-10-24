import { requireRole } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { db } from "@/db";
import { users, cases } from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { parseDateFilter } from "@/lib/date-utils";
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
import { SuperAdminDashboardClient } from "./super-admin-dashboard-client";

interface SuperAdminDashboardPageProps {
  searchParams?: Promise<{
    date?: string | string[];
    from?: string | string[];
    to?: string | string[];
  }>;
}

export default async function SuperAdminDashboard({
  searchParams,
}: SuperAdminDashboardPageProps) {
  const user = await requireRole("super_admin");
  const rawParams = searchParams ? await searchParams : {};
  const filter = parseDateFilter(rawParams);

  // 1. Fetch core summaries and chart datasets in parallel
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
  ] = await Promise.all([
    getDashboardSummary(user, filter),
    getPeopleSummary(user, filter),
    getCaseMovements(user, filter),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, "admin")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, "therapist")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(cases)
      .where(inArray(cases.status, ["assigned", "accepted", "in_progress"])),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(cases),
    getActivityHeatmapData(filter.endDate),
    getPipelineFunnelData(filter),
    getDailyTrendData(filter),
    getTherapistCapacityList(),
    getAdminProductivityList(filter),
  ]);

  // 2. Status breakdown for charts
  const statusRows = await db
    .select({
      status: cases.status,
      count: sql<number>`count(*)::int`,
    })
    .from(cases)
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

  // 3. Category breakdown for charts
  const categoryRows = await db
    .select({
      category: cases.category,
      count: sql<number>`count(*)::int`,
    })
    .from(cases)
    .groupBy(cases.category)
    .orderBy(sql`count(*) DESC`)
    .limit(6);

  const categoryData = categoryRows.map((r) => ({
    name: r.category,
    value: r.count,
  }));

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
      />
    </DashboardShell>
  );
}
