import { db } from "@/db";
import { emailQueue, users } from "@/db/schema";
import { eq, and, lte, or, sql } from "drizzle-orm";
import { getEnv } from "@/lib/env";
import type {
  EmailProvider,
  NotificationType,
  SendEmailResult,
  EmailDeliveryStatus,
} from "./types";
import { ResendProvider } from "./providers/resend";
import { mockEmailProvider } from "./providers/mock";
import { renderEmail } from "./templates";
import { getEmailQuotaUsage, getIstTodayRange } from "./quota";

export * from "./types";
export * from "./templates";
export * from "./quota";
export { ResendProvider } from "./providers/resend";
export { mockEmailProvider, MockProvider } from "./providers/mock";

let resendProviderInstance: ResendProvider | null = null;

/**
 * Returns the configured EmailProvider based on EMAIL_PROVIDER.
 * Ensures automated tests never send real emails unless explicitly authorized.
 */
export function getEmailProvider(): EmailProvider {
  const env = getEnv();

  // Test guard: throw if running automated tests with Resend unless ALLOW_REAL_EMAIL_TESTS is explicitly true
  const isTestEnvironment =
    process.env.NODE_ENV === "test" ||
    Boolean(process.env.PLAYWRIGHT_TEST) ||
    Boolean(process.env.VITEST) ||
    Boolean(process.env.JEST_WORKER_ID);

  if (env.EMAIL_PROVIDER === "resend") {
    if (isTestEnvironment && !env.ALLOW_REAL_EMAIL_TESTS) {
      throw new Error(
        "Automated tests must NEVER send real email. Set EMAIL_PROVIDER=mock or ALLOW_REAL_EMAIL_TESTS=true."
      );
    }

    if (!resendProviderInstance) {
      resendProviderInstance = new ResendProvider(env.RESEND_API_KEY);
    }
    return resendProviderInstance;
  }

  return mockEmailProvider;
}

export interface NotifyParams {
  toEmail: string;
  toName?: string;
  template: NotificationType;
  payload: Record<string, unknown>;
  priority?: number;
}

/**
 * Queues an email notification into the outbox within an optional database transaction.
 * Must be executed within the same database transaction to guarantee atomicity.
 */
export async function queueNotification(
  tx: { insert: typeof db.insert },
  params: NotifyParams
): Promise<void> {
  const rendered = renderEmail(params.template, params.payload);
  const priority = params.priority ?? rendered.priority;

  await (tx as typeof db).insert(emailQueue).values({
    toEmail: params.toEmail.trim().toLowerCase(),
    toName: params.toName,
    template: params.template,
    payload: params.payload,
    status: "pending",
    priority,
  });
}

const MAX_RETRIES = 3;
let lastOpportunisticRun = 0;

/**
 * Processes up to `batchSize` pending or deferred emails from the outbox queue.
 * Respects IST daily and monthly quota limits, enforces priority ordering,
 * and throttles requests appropriately.
 */
export async function processNotificationQueue(batchSize = 10): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  deferred: number;
}> {
  const quota = await getEmailQuotaUsage();
  const { tomorrowStart } = getIstTodayRange();
  const now = new Date();

  // 1. If daily or monthly limit is already exceeded, mark pending deliveries as deferred
  if (quota.isDailyExceeded || quota.isMonthlyExceeded) {
    const deferredCount = await db
      .update(emailQueue)
      .set({
        status: "deferred",
        deferredUntil: tomorrowStart,
        lastError: quota.isDailyExceeded
          ? "Daily email limit reached (90 emails/day). Deferred until tomorrow."
          : "Monthly email limit reached (2,800 emails/month). Deferred until next reset.",
      })
      .where(eq(emailQueue.status, "pending"));

    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
      deferred: Number((deferredCount as any)?.rowCount || 0),
    };
  }

  // 2. Query eligible emails for delivery
  // Eligible: (pending OR (deferred AND deferredUntil <= now))
  // Ordered by: priority ASC (1=account/assigned, 2=closed, 3=rest), createdAt ASC
  const pendingDeliveries = await db
    .select()
    .from(emailQueue)
    .where(
      and(
        or(
          eq(emailQueue.status, "pending"),
          and(
            eq(emailQueue.status, "deferred"),
            lte(emailQueue.deferredUntil, now)
          )
        ),
        lte(emailQueue.retryCount, MAX_RETRIES - 1),
        eq(emailQueue.emailUndeliverable, false)
      )
    )
    .orderBy(emailQueue.priority, emailQueue.createdAt)
    .limit(batchSize)
    .for("update", { skipLocked: true });

  if (pendingDeliveries.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, deferred: 0 };
  }

  const provider = getEmailProvider();
  let succeeded = 0;
  let failed = 0;
  let deferred = 0;
  let sentInThisBatch = 0;

  for (const delivery of pendingDeliveries) {
    // Check if we hit daily limit during processing
    if (quota.todaySent + sentInThisBatch >= quota.dailyLimit) {
      await db
        .update(emailQueue)
        .set({
          status: "deferred",
          deferredUntil: tomorrowStart,
          lastError: "Daily quota reached during batch processing. Deferred until tomorrow.",
        })
        .where(eq(emailQueue.id, delivery.id));
      deferred++;
      continue;
    }

    const rendered = renderEmail(
      delivery.template as NotificationType,
      delivery.payload as Record<string, unknown>
    );

    const sendResult: SendEmailResult = await provider.send({
      to: delivery.toEmail,
      toName: delivery.toName || undefined,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      tags: {
        type: delivery.template,
      },
      idempotencyKey: delivery.id, // Delivery UUID ensures idempotency
    });

    if (sendResult.success) {
      await db
        .update(emailQueue)
        .set({
          status: "sent",
          providerMessageId: sendResult.providerMessageId,
          sentAt: new Date(),
          lastError: null,
        })
        .where(eq(emailQueue.id, delivery.id));

      succeeded++;
      sentInThisBatch++;
    } else {
      const error = sendResult.error;
      const newRetryCount = delivery.retryCount + 1;

      if (error.kind === "validation") {
        // Permanent failure: do not retry
        await db
          .update(emailQueue)
          .set({
            status: "failed",
            lastError: `Validation error: ${error.message}`,
          })
          .where(eq(emailQueue.id, delivery.id));
        failed++;
      } else if (error.kind === "quota_exceeded") {
        // Quota error: defer until tomorrow
        await db
          .update(emailQueue)
          .set({
            status: "deferred",
            deferredUntil: tomorrowStart,
            lastError: `Quota exceeded: ${error.message}`,
          })
          .where(eq(emailQueue.id, delivery.id));
        deferred++;
      } else {
        // Rate limit (429) or temporary server errors (5xx): retry with backoff
        const isFinalAttempt = newRetryCount >= MAX_RETRIES;
        await db
          .update(emailQueue)
          .set({
            retryCount: newRetryCount,
            status: isFinalAttempt ? "failed" : "pending",
            lastError: `Attempt ${newRetryCount}/${MAX_RETRIES} error: ${error.message}`,
          })
          .where(eq(emailQueue.id, delivery.id));

        if (isFinalAttempt) {
          failed++;
        }
      }
    }
  }

  return {
    processed: pendingDeliveries.length,
    succeeded,
    failed,
    deferred,
  };
}

/**
 * Opportunistically runs background queue processing if at least 60 seconds have elapsed.
 * Safe to fire-and-forget on authenticated requests.
 */
export function triggerOpportunisticQueueProcess(): void {
  const now = Date.now();
  if (now - lastOpportunisticRun < 60_000) {
    return;
  }
  lastOpportunisticRun = now;

  // Run asynchronously without awaiting
  processNotificationQueue(5).catch((err) => {
    console.error("[Notifications] Opportunistic processing error:", err);
  });
}
