import { requireRole } from "@/lib/session";
import { getEnv, getFormattedSender } from "@/lib/env";
import { getEmailQuotaUsage } from "@/lib/notifications/quota";
import { db } from "@/db";
import { emailQueue, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { NotificationsClient } from "./notifications-client";
import Link from "next/link";
import { LogoutButton } from "@/components/layout/logout-button";
import { User } from "lucide-react";

export const metadata = {
  title: "Notification Delivery | Guild Club Services",
  description: "Monitor email delivery, daily limits, and test live Resend sending.",
};

export default async function SuperAdminNotificationsPage() {
  const user = await requireRole("super_admin");

  const env = getEnv();
  const quota = await getEmailQuotaUsage();
  const senderAddress = getFormattedSender(env);

  // Fetch recent deliveries
  const rawDeliveries = await db
    .select()
    .from(emailQueue)
    .orderBy(desc(emailQueue.createdAt))
    .limit(50);

  const deliveries = rawDeliveries.map((d) => ({
    id: d.id,
    toEmail: d.toEmail,
    toName: d.toName,
    template: d.template,
    status: d.status,
    priority: d.priority,
    retryCount: d.retryCount,
    lastError: d.lastError,
    providerMessageId: d.providerMessageId,
    sentAt: d.sentAt
      ? d.sentAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
      : null,
    createdAt: d.createdAt.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    }),
  }));

  // Fetch undeliverable users
  const undeliverableUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(eq(users.emailUndeliverable, true));

  return (
    <DashboardShell user={user} title="Notification Delivery">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Notification Delivery &amp; Quota
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor outbox delivery statuses, Resend live provider limits, and queue health.
          </p>
        </div>

        {/* Quick Profile & Sign Out Actions (Reachable from More menu) */}
        <div data-testid="more-menu-actions" className="bg-white border border-slate-200 p-4 rounded-none shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Account &amp; Security
            </span>
            <span className="text-xs text-slate-400">Super Administrator</span>
          </div>
          <div className="flex flex-col gap-2.5">
            <Link
              href="/profile"
              data-testid="more-menu-profile-link"
              className="w-full min-h-[48px] h-[48px] border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 text-sm font-semibold uppercase tracking-wider rounded-none inline-flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
            >
              <User className="w-4 h-4 text-[#0B7A63]" />
              <span>My Profile &amp; Settings</span>
            </Link>
            <LogoutButton
              role={user.role}
              variant="destructive-outline"
              testId="more-menu-logout-button"
              label="Sign Out"
            />
          </div>
        </div>

        <NotificationsClient
          quota={quota}
          deliveries={deliveries}
          undeliverableUsers={undeliverableUsers}
          providerName={env.EMAIL_PROVIDER}
          senderAddress={senderAddress}
        />
      </div>
    </DashboardShell>
  );
}
