import type {
  EmailProvider,
  SendEmailOptions,
  SendEmailResult,
  EmailProviderError,
} from "../types";

export interface SentEmailRecord {
  id: string;
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  tags?: Record<string, string>;
  idempotencyKey?: string;
  sentAt: Date;
}

export class MockProvider implements EmailProvider {
  readonly name = "mock";
  private sentEmails: SentEmailRecord[] = [];
  private nextError: EmailProviderError | null = null;
  private failCount = 0;
  private currentFailAttempt = 0;

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    if (this.nextError) {
      if (this.failCount > 0 && this.currentFailAttempt < this.failCount) {
        this.currentFailAttempt++;
        const err = this.nextError;
        if (this.currentFailAttempt >= this.failCount) {
          this.nextError = null;
          this.failCount = 0;
          this.currentFailAttempt = 0;
        }
        return { success: false, error: err };
      } else if (this.failCount === 0) {
        const err = this.nextError;
        this.nextError = null;
        return { success: false, error: err };
      }
    }

    const providerMessageId = `mock_msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    this.sentEmails.push({
      id: providerMessageId,
      to: options.to,
      toName: options.toName,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
      tags: options.tags,
      idempotencyKey: options.idempotencyKey,
      sentAt: new Date(),
    });

    return {
      success: true,
      providerMessageId,
    };
  }

  getSentEmails(): SentEmailRecord[] {
    return [...this.sentEmails];
  }

  getLastSentEmail(): SentEmailRecord | undefined {
    return this.sentEmails[this.sentEmails.length - 1];
  }

  clearSentEmails(): void {
    this.sentEmails = [];
    this.nextError = null;
    this.failCount = 0;
    this.currentFailAttempt = 0;
  }

  simulateError(error: EmailProviderError | null, times = 1): void {
    this.nextError = error;
    this.failCount = times;
    this.currentFailAttempt = 0;
  }
}

// Global mock singleton for easy access in tests
export const mockEmailProvider = new MockProvider();
