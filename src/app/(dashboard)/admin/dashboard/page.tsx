import { requireRole } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { parseDateFilter } from "@/lib/date-utils";
import { getAdminSimplifiedDashboardData } from "@/lib/dashboard-admin";
import { AdminDashboardClient } from "./admin-dashboard-client";
import { getScope } from "@/lib/scope";
import { BranchPickerCard } from "@/components/layout/branch-picker-card";

export const metadata = {
  title: "Dashboard | Guild Club Services",
};

interface AdminDashboardPageProps {
  searchParams?: Promise<{
    date?: string | string[];
    from?: string | string[];
    to?: string | string[];
    branch?: string;
  }>;
}

export default async function AdminDashboard({
  searchParams,
}: AdminDashboardPageProps) {
  const user = await requireRole("admin", "super_admin");
  const rawParams = searchParams ? await searchParams : {};
  const filter = parseDateFilter(rawParams);
  const branchParam = typeof rawParams.branch === "string" ? rawParams.branch : undefined;

  const scope = await getScope(user, branchParam);

  if (user.role === "admin" && scope.allowedBranches.length === 0) {
    return (
      <DashboardShell user={user} title="Dashboard">
        <div
          data-testid="no-branch-message"
          className="border border-amber-300 bg-amber-50 p-6 text-amber-900 rounded-none shadow-xs"
        >
          <h2 className="text-base font-semibold text-amber-950 mb-1">
            No Active Branch
          </h2>
          <p className="text-sm">
            Your account is not linked to an active branch. Contact your Super Admin.
          </p>
        </div>
      </DashboardShell>
    );
  }

  if (scope.isSuperAdmin && !scope.hasSelectedBranch) {
    return (
      <DashboardShell user={user} title="Dashboard">
        <BranchPickerCard branches={scope.allowedBranches} />
      </DashboardShell>
    );
  }

  const dashboardData = await getAdminSimplifiedDashboardData(
    filter,
    scope.activeBranchId
  );

  return (
    <DashboardShell user={user} title="Dashboard">
      <AdminDashboardClient data={dashboardData} />
    </DashboardShell>
  );
}
