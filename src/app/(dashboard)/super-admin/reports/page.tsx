import { requireRole } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getSuperAdminReports } from "@/lib/dashboard";
import { formatDisplayDate, getTodayIST } from "@/lib/date-utils";
import { getScope } from "@/lib/scope";
import { BranchPickerCard } from "@/components/layout/branch-picker-card";
import { ReportsClient } from "./reports-client";

interface SuperAdminReportsPageProps {
  searchParams?: Promise<{
    from?: string | string[];
    to?: string | string[];
    date?: string | string[];
    branch?: string;
  }>;
}

export default async function SuperAdminReportsPage({
  searchParams,
}: SuperAdminReportsPageProps) {
  const user = await requireRole("super_admin");
  const rawParams = searchParams ? await searchParams : {};
  const branchParam = typeof rawParams.branch === "string" ? rawParams.branch : undefined;

  const scope = await getScope(user, branchParam);

  // If Super Admin hasn't selected a branch, show the branch picker card
  if (!scope.hasSelectedBranch || !scope.activeBranchId) {
    return (
      <DashboardShell user={user} title="Reports">
        <BranchPickerCard
          branches={scope.allowedBranches}
          title="Select a Branch to View Reports"
          description="Super Administrator exports reports by picking a branch first. Choose an active branch to configure and download reports."
        />
      </DashboardShell>
    );
  }

  const activeBranchId = scope.activeBranchId;
  const selectedBranch = scope.allowedBranches.find((b) => b.id === activeBranchId);

  const todayIST = getTodayIST();
  const rawDate = Array.isArray(rawParams.date) ? rawParams.date[0] : rawParams.date;
  const defaultDate =
    rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayIST;

  const rawFrom = Array.isArray(rawParams.from) ? rawParams.from[0] : rawParams.from;
  const rawTo = Array.isArray(rawParams.to) ? rawParams.to[0] : rawParams.to;

  const from = rawFrom && /^\d{4}-\d{2}-\d{2}$/.test(rawFrom) ? rawFrom : defaultDate;
  const to = rawTo && /^\d{4}-\d{2}-\d{2}$/.test(rawTo) ? rawTo : defaultDate;

  const data = await getSuperAdminReports({
    startDate: from,
    endDate: to,
    branchId: activeBranchId,
  });

  const dateRangeLabel =
    from === to
      ? formatDisplayDate(from)
      : `${formatDisplayDate(from)} – ${formatDisplayDate(to)}`;

  return (
    <DashboardShell user={user} title="Reports">
      <ReportsClient
        data={data}
        dateRangeLabel={dateRangeLabel}
        startDate={from}
        endDate={to}
        branchName={selectedBranch?.name || "Clinic Branch"}
      />
    </DashboardShell>
  );
}
