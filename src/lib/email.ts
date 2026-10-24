import { db } from "@/db";
import { emailQueue } from "@/db/schema";
import { eq, and, lte } from "drizzle-orm";
import { Resend } from "resend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ─── Template Types ──────────────────────────────────────────────────────────
// Credentials email templates and password_reset have been removed per specification.
// Passwords are now managed directly by account creators/administrators.

export type EmailTemplate =
  | "case_assigned"
  | "case_declined"
  | "case_closed";

export interface QueueEmailParams {
  toEmail: string;
  toName?: string;
  template: EmailTemplate;
  payload: Record<string, unknown>;
}

// ─── Queue ────────────────────────────────────────────────────────────────────

/**
 * Inserts an email job into the queue. Must be called inside a DB transaction
 * if you need the enqueue to be part of the same atomic operation.
 */
export async function queueEmail(
  tx: { insert: typeof db.insert },
  params: QueueEmailParams
) {
  await (tx as typeof db).insert(emailQueue).values({
    toEmail: params.toEmail,
    toName: params.toName,
    template: params.template,
    payload: params.payload,
    status: "pending",
  });
}

// ─── Templates ───────────────────────────────────────────────────────────────

function renderTemplate(
  template: EmailTemplate,
  payload: Record<string, unknown>
): { subject: string; html: string } {
  switch (template) {
    case "case_assigned":
      return {
        subject: `New Case Assigned: ${payload.caseNumber} (${payload.priority})`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
            <h2 style="color:#0369a1">New Case Assignment</h2>
            <p>Hello <strong>${payload.therapistName}</strong>,</p>
            <p>A new case has been assigned to you.</p>
            <div style="background:#f0f9ff;border:1px solid #7dd3fc;border-radius:8px;padding:16px;margin:16px 0">
              <p style="margin:4px 0"><strong>Case Number:</strong> ${payload.caseNumber}</p>
              <p style="margin:4px 0"><strong>Priority:</strong> ${String(payload.priority).toUpperCase()}</p>
              <p style="margin:4px 0"><strong>Category:</strong> ${payload.category}</p>
              <p style="margin:4px 0"><strong>Client:</strong> ${payload.clientName}</p>
            </div>
            <p><a href="${APP_URL}/therapist/cases/${payload.caseId}" style="background:#0369a1;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">View Case</a></p>
            <p style="color:#6b7280;font-size:12px">Guild Club Services — Therapy Case Management</p>
          </div>`,
      };

    case "case_declined":
      return {
        subject: `Case Declined: ${payload.caseNumber}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
            <h2 style="color:#dc2626">Case Declined</h2>
            <p>Hello <strong>${payload.adminName}</strong>,</p>
            <p>Case <strong>${payload.caseNumber}</strong> was declined by therapist <strong>${payload.therapistName}</strong>.</p>
            <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:16px;margin:16px 0">
              <p style="margin:4px 0"><strong>Reason:</strong> ${payload.reason}</p>
            </div>
            <p>The case has been returned to <em>New</em> status and is available for reassignment.</p>
            <p><a href="${APP_URL}/admin/cases/${payload.caseId}" style="background:#dc2626;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Reassign Case</a></p>
            <p style="color:#6b7280;font-size:12px">Guild Club Services — Therapy Case Management</p>
          </div>`,
      };

    case "case_closed":
      return {
        subject: `Case Closed: ${payload.caseNumber} — ${payload.outcome}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
            <h2 style="color:#065f46">Case Closed</h2>
            <p>Hello <strong>${payload.adminName}</strong>,</p>
            <p>Case <strong>${payload.caseNumber}</strong> has been closed by therapist <strong>${payload.therapistName}</strong>.</p>
            <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px;margin:16px 0">
              <p style="margin:4px 0"><strong>Outcome:</strong> ${String(payload.outcome).toUpperCase()}</p>
              <p style="margin:4px 0"><strong>Closed At:</strong> ${payload.closedAt}</p>
            </div>
            <p><a href="${APP_URL}/admin/cases/${payload.caseId}" style="background:#065f46;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">View Case</a></p>
            <p style="color:#6b7280;font-size:12px">Guild Club Services — Therapy Case Management</p>
          </div>`,
      };

    default:
      return { subject: "Guild Club Services Notification", html: "<p>You have a new notification.</p>" };
  }
}

// ─── Processor ───────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;

/**
 * Processes up to `batchSize` pending emails from the queue.
 * Safe to call from a cron/API route. Each email is processed independently.
 */
export async function processEmailQueue(batchSize = 10): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM ?? "noreply@guildclubservices.com";

  let resend: Resend | null = null;
  const isDev = !resendApiKey || resendApiKey.startsWith("re_dev") || resendApiKey.startsWith("re_test");

  if (!isDev) {
    resend = new Resend(resendApiKey);
  }

  // Fetch pending emails with retry budget remaining
  const pending = await db
    .select()
    .from(emailQueue)
    .where(
      and(
        eq(emailQueue.status, "pending"),
        lte(emailQueue.retryCount, MAX_RETRIES - 1)
      )
    )
    .limit(batchSize)
    .for("update", { skipLocked: true });

  let succeeded = 0;
  let failed = 0;

  for (const email of pending) {
    const { subject, html } = renderTemplate(
      email.template as EmailTemplate,
      email.payload
    );

    try {
      if (isDev) {
        // Development: log to console instead of sending
        console.log(`[EMAIL QUEUE] DEV mode — would send email:`, {
          to: email.toEmail,
          subject,
        });
      } else {
        await resend!.emails.send({
          from: emailFrom,
          to: email.toEmail,
          subject,
          html,
        });
      }

      await db
        .update(emailQueue)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(emailQueue.id, email.id));

      succeeded++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const newRetryCount = email.retryCount + 1;

      await db
        .update(emailQueue)
        .set({
          retryCount: newRetryCount,
          lastError: errorMsg,
          status: newRetryCount >= MAX_RETRIES ? "failed" : "pending",
        })
        .where(eq(emailQueue.id, email.id));

      failed++;
    }
  }

  return { processed: pending.length, succeeded, failed };
}
