"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import {
  sendTestEmailToMyselfAction,
  retryNotificationsAction,
} from "@/lib/actions/notification-actions";
import type { QuotaUsage } from "@/lib/notifications/quota";

interface DeliveryItem {
  id: string;
  toEmail: string;
  toName: string | null;
  template: string;
  status: string;
  priority: number;
  retryCount: number;
  lastError: string | null;
  providerMessageId: string | null;
  sentAt: string | null;
  createdAt: string;
}

interface UndeliverableUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface NotificationsClientProps {
  quota: QuotaUsage;
  deliveries: DeliveryItem[];
  undeliverableUsers: UndeliverableUser[];
  providerName: string;
  senderAddress: string;
}

export function NotificationsClient({
  quota,
  deliveries,
  undeliverableUsers,
  providerName,
  senderAddress,
}: NotificationsClientProps) {
  const [isSendingTest, setIsSendingTest] = React.useState(false);
  const [isRetrying, setIsRetrying] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleSendTest = async () => {
    setIsSendingTest(true);
    setFeedback(null);
    try {
      const res = await sendTestEmailToMyselfAction();
      if (res.success) {
        setFeedback({
          type: "success",
          message: `Test email sent successfully! Resend Message ID: ${res.messageId}`,
        });
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Failed to send test email.",
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.message || "An unexpected error occurred while sending test email.",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    setFeedback(null);
    try {
      const res = await retryNotificationsAction();
      if (res.success && res.data) {
        setFeedback({
          type: "success",
          message: `Processed ${res.data.processed} emails (${res.data.succeeded} succeeded, ${res.data.failed} failed, ${res.data.deferred} deferred).`,
        });
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Failed to process queue.",
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.message || "Failed to process queue.",
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "delivered":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "sent":
        return "bg-teal-100 text-teal-800 border-teal-300";
      case "pending":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "deferred":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "bounced":
      case "complained":
      case "failed":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-slate-100 text-slate-800 border-slate-300";
    }
  };

  return (
    <div className="space-y-6">
      {/* 80% Quota Warning Banner */}
      {quota.isWarning && (
        <div
          data-testid="quota-warning-banner"
          className="border-l-4 border-amber-500 bg-amber-50 p-4 text-amber-900 rounded-none border border-amber-200"
        >
          <div className="flex items-center gap-3">
            <Icons.Alert className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-semibold text-sm">
                Email Quota Warning (Usage &ge; 80%)
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                Today&apos;s usage is at {quota.dailyPercent}% ({quota.todaySent} / {quota.dailyLimit} emails) and monthly usage is at {quota.monthlyPercent}% ({quota.monthSent} / {quota.monthlyLimit} emails). Once daily quota is reached, subsequent deliveries are deferred to 00:00 IST tomorrow.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Undeliverable Addresses Warning */}
      {undeliverableUsers.length > 0 && (
        <div
          data-testid="undeliverable-users-banner"
          className="border-l-4 border-red-500 bg-red-50 p-4 text-red-900 rounded-none border border-red-200"
        >
          <div className="flex items-start gap-3">
            <Icons.Alert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-sm">
                Undeliverable Email Addresses Detected ({undeliverableUsers.length})
              </p>
              <p className="text-xs text-red-800">
                The following users have recorded hard bounces or spam complaints. Outbox retries have been permanently halted for these accounts until their email is corrected:
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {undeliverableUsers.map((u) => (
                  <span
                    key={u.id}
                    className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-red-200 text-red-900 text-xs font-mono"
                  >
                    {u.name} &lt;{u.email}&gt; ({u.role})
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 border text-sm font-medium rounded-none ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-300 text-emerald-900"
              : "bg-red-50 border-red-300 text-red-900"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Today's Quota */}
        <div className="bg-white border border-slate-200 p-5 shadow-sm rounded-none">
          <div className="flex items-center justify-between text-slate-600 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Today&apos;s Usage (IST)</span>
            <span
              className={`px-1.5 py-0.5 text-[11px] font-bold ${
                quota.isDailyExceeded
                  ? "bg-red-100 text-red-700"
                  : quota.dailyPercent >= 80
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {quota.dailyPercent}%
            </span>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-2xl font-bold text-slate-900">
              {quota.todaySent}
            </span>
            <span className="text-sm font-medium text-slate-500">
              / {quota.dailyLimit} emails
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 h-2 rounded-none overflow-hidden">
            <div
              className={`h-full transition-all ${
                quota.dailyPercent >= 80 ? "bg-amber-500" : "bg-[#0B7A63]"
              }`}
              style={{ width: `${quota.dailyPercent}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {quota.todayRemaining} emails remaining today before deferral
          </p>
        </div>

        {/* This Month's Quota */}
        <div className="bg-white border border-slate-200 p-5 shadow-sm rounded-none">
          <div className="flex items-center justify-between text-slate-600 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Monthly Usage (IST)</span>
            <span
              className={`px-1.5 py-0.5 text-[11px] font-bold ${
                quota.isMonthlyExceeded
                  ? "bg-red-100 text-red-700"
                  : quota.monthlyPercent >= 80
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {quota.monthlyPercent}%
            </span>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-2xl font-bold text-slate-900">
              {quota.monthSent}
            </span>
            <span className="text-sm font-medium text-slate-500">
              / {quota.monthlyLimit} emails
            </span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-none overflow-hidden">
            <div
              className={`h-full transition-all ${
                quota.monthlyPercent >= 80 ? "bg-amber-500" : "bg-[#0B7A63]"
              }`}
              style={{ width: `${quota.monthlyPercent}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {quota.monthRemaining} emails remaining this month
          </p>
        </div>

        {/* Active Provider Info */}
        <div className="bg-white border border-slate-200 p-5 shadow-sm rounded-none">
          <div className="text-slate-600 text-xs font-semibold uppercase tracking-wider mb-2">
            Active Provider
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block h-2.5 w-2.5 rounded-none bg-emerald-500" />
            <span className="text-lg font-bold text-slate-900 uppercase">
              {providerName}
            </span>
          </div>
          <div className="text-xs text-slate-600 space-y-1">
            <p className="truncate">
              <strong>Sender:</strong> {senderAddress}
            </p>
            <p>
              <strong>Throttling:</strong> ~600ms sequential send delay
            </p>
          </div>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 p-4 shadow-sm rounded-none">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Outbox Queue Management &amp; Diagnostics
          </h2>
          <p className="text-xs text-slate-500">
            Send live sample verification emails or process pending &amp; deferred deliveries manually.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleRetry}
            disabled={isRetrying}
            className="rounded-none cursor-pointer"
          >
            {isRetrying ? "Processing..." : "Retry & Process Queue"}
          </Button>

          <Button
            type="button"
            variant="primary"
            onClick={handleSendTest}
            disabled={isSendingTest}
            className="rounded-none cursor-pointer"
          >
            {isSendingTest ? "Sending Test..." : "Send test email to myself"}
          </Button>
        </div>
      </div>

      {/* Delivery Log Table */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-none overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            Recent Delivery Activity ({deliveries.length})
          </h3>
          <span className="text-xs text-slate-500">
            Ordered by newest first
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Date / Time (IST)</th>
                <th className="py-3 px-4">Recipient</th>
                <th className="py-3 px-4">Template</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Provider Message ID / Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deliveries.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-slate-500 text-sm"
                  >
                    No email deliveries recorded yet.
                  </td>
                </tr>
              ) : (
                deliveries.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                      {item.sentAt || item.createdAt}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">
                        {item.toName || "—"}
                      </div>
                      <div className="font-mono text-slate-500 text-[11px]">
                        {item.toEmail}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-700">
                      {item.template}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      <span className="inline-block px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-[10px] font-bold">
                        P{item.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 border text-[10px] font-bold uppercase rounded-none ${getStatusBadge(
                          item.status
                        )}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 max-w-xs truncate">
                      {item.providerMessageId ? (
                        <span className="text-slate-700">
                          ID: {item.providerMessageId}
                        </span>
                      ) : item.lastError ? (
                        <span className="text-red-600">{item.lastError}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
