import { requireRole } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getSuperAdminReports } from "@/lib/dashboard";
import { formatDisplayDate } from "@/lib/date-utils";
import { ReportsClient } from "./reports-client";

interface SuperAdminReportsPageProps {
  searchParams?: Promise<{
    from?: string | string[];
    to?: string | string[];
  }>;
}

export default async function SuperAdminReportsPage({
  searchParams,
}: SuperAdminReportsPageProps) {
  const user = await requireRole("super_admin");
  const rawParams = searchParams ? await searchParams : {};

  const from = Array.isArray(rawParams.from) ? rawParams.from[0] : rawParams.from;
  const to = Array.isArray(rawParams.to) ? rawParams.to[0] : rawParams.to;

  const hasFilter = Boolean(from && to);
  const data = await getSuperAdminReports({
    startDate: from,
    endDate: to,
  });

  const dateRangeLabel = hasFilter
    ? `${formatDisplayDate(from!)} – ${formatDisplayDate(to!)}`
    : "All Time Cumulative";

  return (
    <DashboardShell user={user} title="Analytics & Executive Reports">
      <ReportsClient
        data={data}
        dateRangeLabel={dateRangeLabel}
        startDate={from}
        endDate={to}
      />
    </DashboardShell>
  );
}
