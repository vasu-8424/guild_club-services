import { requireRole } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { NotificationsView } from "./notifications-view";

export default async function NotificationsPage() {
  const user = await requireRole("admin", "super_admin", "therapist");

  return (
    <DashboardShell user={user} title="Notifications">
      <NotificationsView user={user} />
    </DashboardShell>
  );
}
