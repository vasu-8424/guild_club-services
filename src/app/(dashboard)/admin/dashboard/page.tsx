import { requireRole } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { parseDateFilter } from "@/lib/date-utils";
import { getAdminSimplifiedDashboardData } from "@/lib/dashboard-admin";
import { AdminDashboardClient } from "./admin-dashboard-client";

export const metadata = {
  title: "Dashboard | Guild Club Services",
};

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

  const dashboardData = await getAdminSimplifiedDashboardData(filter);

  return (
    <DashboardShell user={user} title="Dashboard">
      <AdminDashboardClient data={dashboardData} />
    </DashboardShell>
  );
}
