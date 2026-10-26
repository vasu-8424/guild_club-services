import { db } from "@/db";
import {
  queueNotification,
  processNotificationQueue,
  type NotificationType,
  type NotifyParams,
} from "./notifications";

export type EmailTemplate = NotificationType;

export interface QueueEmailParams {
  toEmail: string;
  toName?: string;
  template: EmailTemplate;
  payload: Record<string, unknown>;
  priority?: number;
}

/**
 * Inserts an email job into the queue. Must be called inside a DB transaction
 * if you need the enqueue to be part of the same atomic operation.
 */
export async function queueEmail(
  tx: { insert: typeof db.insert },
  params: QueueEmailParams
) {
  await queueNotification(tx, {
    toEmail: params.toEmail,
    toName: params.toName,
    template: params.template,
    payload: params.payload,
    priority: params.priority,
  });
}

/**
 * Processes pending or deferred emails from the queue.
 * Safe to call from a cron or API route.
 */
export async function processEmailQueue(batchSize = 10) {
  return processNotificationQueue(batchSize);
}
