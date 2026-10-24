import { requireRole } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { parseDateFilter } from "@/lib/date-utils";
import {
  getDashboardSummary,
  getPeopleSummary,
  getCaseMovements,
  getUnassignedCasesAsOf,
  getPriorityStatusMatrix,
  getDailyTrendData,
  getPipelineFunnelData,
  getTherapistCapacityList,
  getNeedsAttentionCases,
} from "@/lib/dashboard";
import { db } from "@/db";
import { cases, users, caseEvents } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { AdminDashboardClient } from "./admin-dashboard-client";

interface AdminDashboardPageProps {
  searchParams?: Promise<{
    date?: string | string[];
    from?: string | string[];
    to?: string | string[];
  }>;
}

export default async function AdminDashboard({
  searchParams,
}: AdminDashboardPageProps) {
  const user = await requireRole("admin", "super_admin");
  const rawParams = searchParams ? await searchParams : {};
  const filter = parseDateFilter(rawParams);

  // 1. Fetch date-wise queries and chart datasets in parallel
  const [
    summary,
    people,
    movements,
    unassignedCases,
    priorityMatrix,
    trendData,
    pipelineData,
    therapistCapacity,
    needsAttentionCases,
    inProgressCountRes,
    availableTherapistsRes,
    categoryRows,
  ] = await Promise.all([
    getDashboardSummary(user, filter),
    getPeopleSummary(user, filter),
    getCaseMovements(user, filter),
    getUnassignedCasesAsOf(filter),
    getPriorityStatusMatrix(),
    getDailyTrendData(filter),
    getPipelineFunnelData(filter),
    getTherapistCapacityList(),
    getNeedsAttentionCases(),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(cases)
      .where(eq(cases.status, "in_progress")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, "therapist")),
    db
      .select({
        category: cases.category,
        count: sql<number>`count(*)::int`,
      })
      .from(cases)
      .groupBy(cases.category)
      .orderBy(sql`count(*) DESC`)
      .limit(6),
  ]);

  const categoryData = categoryRows.map((r) => ({
    name: r.category,
    value: r.count,
  }));

  const inProgressCases = inProgressCountRes[0]?.count ?? 0;
  const availableTherapists = availableTherapistsRes[0]?.count ?? 0;

  return (
    <DashboardShell user={user} title="Clinic Administration">
      <AdminDashboardClient
        user={user}
        summary={summary}
        people={people}
        movements={movements}
        unassignedCases={unassignedCases}
        priorityMatrix={priorityMatrix}
        categoryData={categoryData}
        trendData={trendData}
        pipelineData={pipelineData}
        therapistCapacity={therapistCapacity}
        needsAttentionCases={needsAttentionCases}
        inProgressCases={inProgressCases}
        availableTherapists={availableTherapists}
      />
    </DashboardShell>
  );
}
