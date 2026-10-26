import { requireRole } from "@/lib/session";
import { getEnv, getFormattedSender } from "@/lib/env";
import { getEmailQuotaUsage } from "@/lib/notifications/quota";
import { db } from "@/db";
import { emailQueue, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { NotificationsClient } from "./notifications-client";

export const metadata = {
  title: "Notification Delivery | Guild Club Services",
  description: "Monitor email delivery, daily limits, and test live Resend sending.",
};

export default async function SuperAdminNotificationsPage() {
  await requireRole("super_admin");

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
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Notification Delivery &amp; Quota
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Monitor outbox delivery statuses, Resend live provider limits, and queue health.
        </p>
      </div>

      <NotificationsClient
        quota={quota}
        deliveries={deliveries}
        undeliverableUsers={undeliverableUsers}
        providerName={env.EMAIL_PROVIDER}
        senderAddress={senderAddress}
      />
    </div>
  );
}
