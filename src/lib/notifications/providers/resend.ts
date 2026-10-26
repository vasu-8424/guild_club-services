import { Resend } from "resend";
import { getEnv, getFormattedSender } from "@/lib/env";
import type {
  EmailProvider,
  SendEmailOptions,
  SendEmailResult,
  EmailErrorKind,
} from "../types";

/**
 * Strips carriage returns and newlines to prevent header injection.
 */
export function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/**
 * Masks an email for safe logging (e.g., "d***e@domain.com").
 */
export function maskEmail(email: string): string {
  const parts = email.split("@");
  if (parts.length !== 2) return "***";
  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local[0] || "*"}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export class ResendProvider implements EmailProvider {
  readonly name = "resend";
  private resendClient: Resend | null = null;
  private lastSendTimestamp = 0;
  private readonly minDelayMs = 600; // Resend rate limit safety delay (1 request per ~600ms)

  constructor(apiKey?: string) {
    const key = apiKey || getEnv().RESEND_API_KEY;
    if (key) {
      this.resendClient = new Resend(key);
    }
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastSendTimestamp;
    if (elapsed < this.minDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.minDelayMs - elapsed));
    }
    this.lastSendTimestamp = Date.now();
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    const env = getEnv();
    const apiKey = env.RESEND_API_KEY;

    if (!this.resendClient && apiKey) {
      this.resendClient = new Resend(apiKey);
    }

    if (!this.resendClient) {
      return {
        success: false,
        error: {
          kind: "validation",
          message: "RESEND_API_KEY is not configured",
        },
      };
    }

    // Enforce throttling between sends to respect Resend's free tier rate limits
    await this.throttle();

    // Sanitize headers
    const sanitizedTo = sanitizeHeader(options.to);
    const sanitizedSubject = sanitizeHeader(options.subject);
    const sender = getFormattedSender(env);

    const replyTo = options.replyTo?.trim() || env.EMAIL_REPLY_TO?.trim() || undefined;

    // Convert tags Record to Resend Tag array
    const tags = options.tags
      ? Object.entries(options.tags).map(([name, value]) => ({
          name: sanitizeHeader(name),
          value: sanitizeHeader(value),
        }))
      : undefined;

    try {
      const response = await this.resendClient.emails.send(
        {
          from: sender,
          to: sanitizedTo,
          subject: sanitizedSubject,
          html: options.html,
          text: options.text,
          replyTo: replyTo ? sanitizeHeader(replyTo) : undefined,
          tags,
        },
        options.idempotencyKey
          ? {
              idempotencyKey: options.idempotencyKey,
            }
          : undefined
      );

      if (response.error) {
        const error = response.error;
        const statusCode = (error as any).statusCode || (error as any).status;
        const errorMsg = error.message || String(error);

        const kind = this.classifyError(errorMsg, statusCode);

        console.warn(
          `[ResendProvider] Send failed (masked recipient: ${maskEmail(sanitizedTo)}, kind: ${kind}, status: ${statusCode || "unknown"})`
        );

        return {
          success: false,
          error: {
            kind,
            message: errorMsg,
            statusCode,
            raw: error,
          },
        };
      }

      const messageId = response.data?.id || "unknown";

      console.info(
        `[ResendProvider] Sent email successfully (masked recipient: ${maskEmail(sanitizedTo)}, messageId: ${messageId})`
      );

      return {
        success: true,
        providerMessageId: messageId,
      };
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      const statusCode = err?.statusCode || err?.status;
      const kind = this.classifyError(errorMsg, statusCode);

      console.error(
        `[ResendProvider] Network/Runtime error (masked recipient: ${maskEmail(sanitizedTo)}, kind: ${kind})`
      );

      return {
        success: false,
        error: {
          kind,
          message: errorMsg,
          statusCode,
          raw: err,
        },
      };
    }
  }

  private classifyError(message: string, statusCode?: number): EmailErrorKind {
    const lower = message.toLowerCase();

    // 1. Quota errors (daily or monthly limit reached)
    if (
      lower.includes("daily quota") ||
      lower.includes("monthly quota") ||
      lower.includes("limit reached") ||
      lower.includes("quota exceeded")
    ) {
      return "quota_exceeded";
    }

    // 2. Rate limit (HTTP 429)
    if (statusCode === 429 || lower.includes("rate limit") || lower.includes("too many requests")) {
      return "rate_limit";
    }

    // 3. Validation / permanent errors (bad recipient, unverified domain, missing fields, 400/401/403/422)
    if (
      statusCode === 422 ||
      statusCode === 400 ||
      statusCode === 401 ||
      statusCode === 403 ||
      lower.includes("validation") ||
      lower.includes("invalid") ||
      lower.includes("not verified") ||
      lower.includes("unverified") ||
      lower.includes("domain")
    ) {
      return "validation";
    }

    // 4. Temporary server errors (5xx)
    if (statusCode && statusCode >= 500) {
      return "temporary";
    }

    // Default to temporary for network glitches
    return "temporary";
  }
}
