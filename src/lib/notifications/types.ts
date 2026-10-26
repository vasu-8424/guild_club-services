export type NotificationType =
  | "admin_account_created"
  | "account_created"
  | "case_assigned"
  | "case_reassigned"
  | "case_unassigned"
  | "password_reset"
  | "case_closed"
  | "case_declined"
  | "session_scheduled"
  | "session_completed_group"
  | "admin_note"
  | "test_email";

export interface SendEmailOptions {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  tags?: Record<string, string>;
  idempotencyKey?: string;
}

export type EmailDeliveryStatus =
  | "pending"
  | "sent"
  | "failed"
  | "deferred"
  | "delivered"
  | "bounced"
  | "complained";

export type EmailErrorKind =
  | "validation" // Permanent failure (bad email, invalid domain, etc.)
  | "rate_limit" // 429
  | "temporary"  // 5xx, network timeout
  | "quota_exceeded"; // Quota reached -> deferred

export interface EmailProviderError {
  kind: EmailErrorKind;
  message: string;
  statusCode?: number;
  raw?: unknown;
}

export type SendEmailResult =
  | { success: true; providerMessageId: string }
  | { success: false; error: EmailProviderError };

export interface EmailProvider {
  readonly name: string;
  send(options: SendEmailOptions): Promise<SendEmailResult>;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  priority: number;
}
