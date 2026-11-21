import { requireRole } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { NotificationsView } from "./notifications-view";
import { getNotificationsAction } from "@/lib/actions/notification-actions";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; type?: string; outcome?: string; page?: string }>;
}) {
  const user = await requireRole("admin", "super_admin", "therapist");
  const rawParams = searchParams ? await searchParams : {};
  const tab = (rawParams.tab as any) || "all";
  const type = rawParams.type || "all";
  const outcome = rawParams.outcome || "all";
  const page = rawParams.page ? parseInt(rawParams.page, 10) : 1;

  const res = await getNotificationsAction({
    tab,
    type,
    outcome,
    page,
    pageSize: 10,
  });

  const initialData = res.success && res.data ? res.data : undefined;

  return (
    <DashboardShell user={user} title="Notifications">
      <NotificationsView user={user} initialData={initialData} />
    </DashboardShell>
  );
}
