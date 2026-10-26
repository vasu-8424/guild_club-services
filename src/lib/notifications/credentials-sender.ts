import { db } from "@/db";
import { emailQueue, inAppNotifications } from "@/db/schema";
import { getEnv } from "@/lib/env";
import { getEmailProvider } from "./index";
import { getEmailQuotaUsage } from "./quota";
import { maskEmail } from "./providers/resend";
import type { SendEmailResult } from "./types";

export interface SendCredentialsParams {
  userId: string;
  toEmail: string;
  toName: string;
  role: "admin" | "therapist";
  createdByName: string;
  password?: string;
  emailCredentials?: boolean;
}

export interface SendCredentialsResult {
  success: boolean;
  emailSent: boolean;
  providerMessageId?: string;
  error?: string;
  quotaExceeded?: boolean;
}

const BUTTON_STYLE = `
  background-color: #0B7A63;
  border-bottom: 2px solid #064336;
  color: #ffffff;
  padding: 12px 28px;
  text-decoration: none;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  display: inline-block;
  border-radius: 0px;
  line-height: 1;
`;

/**
 * Builds the credentials email with sharp premium UI, monospaced password box,
 * action list, and security notices.
 */
export function renderCredentialsEmail(options: {
  toEmail: string;
  toName: string;
  role: "admin" | "therapist";
  createdByName: string;
  password?: string;
  includePassword?: boolean;
  baseUrl: string;
  replyTo: string;
}): { subject: string; html: string; text: string } {
  const { toEmail, toName, role, createdByName, password, includePassword, baseUrl, replyTo } = options;
  const loginUrl = `${baseUrl.replace(/\/$/, "")}/login`;
  const roleDisplay = role === "admin" ? "Admin" : "Therapist";

  // Subject requirement:
  // Subject: "Your Guild Club Services admin account is ready" (or therapist)
  const subject = role === "admin"
    ? "Your Guild Club Services admin account is ready"
    : "Your Guild Club Services therapist account is ready";

  const passwordDisplay = (includePassword !== false && password)
    ? password
    : (password || null);

  const credentialsBoxHtml = `
    <!-- High-Clarity Account Credentials Box -->
    <div style="background: #f8fafc; border: 2px solid #0B7A63; border-radius: 0px; padding: 22px 24px; margin: 24px 0;">
      <div style="font-size: 12px; font-weight: 800; color: #0B7A63; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
        Your Account Login Credentials
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; color: #334155;">
        <tr>
          <td style="padding: 7px 0; font-weight: 600; color: #64748b; width: 150px;">Portal Web Address:</td>
          <td style="padding: 7px 0; font-weight: 600;">
            <a href="${loginUrl}" style="color: #0B7A63; text-decoration: underline;">${loginUrl}</a>
          </td>
        </tr>
        <tr>
          <td style="padding: 7px 0; font-weight: 600; color: #64748b;">Login ID / Email:</td>
          <td style="padding: 7px 0; font-weight: 700; color: #0f172a; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 15px;">
            ${toEmail}
          </td>
        </tr>
        <tr>
          <td style="padding: 7px 0; font-weight: 600; color: #64748b; vertical-align: middle;">Access Password:</td>
          <td style="padding: 7px 0;">
            <span style="display: inline-block; background: #ffffff; border: 1px solid #0B7A63; padding: 6px 14px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 16px; font-weight: 800; color: #0f172a; letter-spacing: 0.8px;">
              ${passwordDisplay || "Shared securely by administrator"}
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding: 7px 0; font-weight: 600; color: #64748b;">Assigned Role:</td>
          <td style="padding: 7px 0; font-weight: 700; color: #0B7A63;">
            ${roleDisplay}
          </td>
        </tr>
        <tr>
          <td style="padding: 7px 0; font-weight: 600; color: #64748b;">Created By:</td>
          <td style="padding: 7px 0; color: #475569;">
            ${createdByName}
          </td>
        </tr>
      </table>
    </div>
  `;

  const whatYouCanDoHtml = role === "admin"
    ? `
      <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #475569; line-height: 1.8;">
        <li>Create cases</li>
        <li>Register therapists</li>
        <li>Assign cases</li>
        <li>View reports</li>
      </ul>
    `
    : `
      <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #475569; line-height: 1.8;">
        <li>View assigned cases</li>
        <li>Run sessions</li>
        <li>Add notes</li>
        <li>Complete sessions</li>
      </ul>
    `;

  const whatYouCanDoText = role === "admin"
    ? "- Create cases\n- Register therapists\n- Assign cases\n- View reports"
    : "- View assigned cases\n- Run sessions\n- Add notes\n- Complete sessions";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <div style="background-color: #f1f5f9; padding: 32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-spacing: 0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      <tr>
        <td style="height: 4px; background: #0B7A63; line-height: 4px; font-size: 4px;">&nbsp;</td>
      </tr>
      <tr>
        <td style="padding: 24px 32px; border-bottom: 1px solid #f1f5f9; background: #ffffff;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align: middle;">
                <div style="background: #0B7A63; color: #ffffff; font-weight: 800; font-size: 13px; padding: 6px 10px; letter-spacing: 1px; line-height: 1;">
                  GCS
                </div>
              </td>
              <td style="vertical-align: middle; padding-left: 14px;">
                <div style="font-size: 15px; font-weight: 700; color: #0f172a; letter-spacing: -0.2px; line-height: 1.2;">
                  Guild Club Services
                </div>
                <div style="font-size: 11px; font-weight: 600; color: #0B7A63; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 3px;">
                  Therapy &amp; Clinical Management
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 32px; line-height: 1.6;">
          <div style="display: inline-block; background: #e6f4f1; border-left: 3px solid #0B7A63; padding: 4px 10px; font-size: 11px; font-weight: 700; color: #0B7A63; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 14px;">
            ${roleDisplay} Account Credentials
          </div>
          <h1 style="margin: 0 0 18px 0; font-size: 22px; font-weight: 700; color: #0f172a; line-height: 1.3;">
            Your ${roleDisplay} Account is Ready
          </h1>
          <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">
            Hello <strong>${toName}</strong>,
          </p>
          <p style="margin: 0 0 16px 0; font-size: 14px; color: #475569; line-height: 1.6;">
            Your <strong>${roleDisplay}</strong> account has been created by <strong>${createdByName}</strong> on the Guild Club Services platform.
          </p>

          ${credentialsBoxHtml}

          <div style="margin: 24px 0 20px 0;">
            <p style="margin: 0 0 10px 0; font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.6px;">
              What you can do as ${roleDisplay}:
            </p>
            ${whatYouCanDoHtml}
          </div>

          <div style="margin: 28px 0 24px 0;">
            <a href="${loginUrl}" style="${BUTTON_STYLE}">
              Sign In to ${roleDisplay} Portal &rarr;
            </a>
          </div>

          <!-- Security notes -->
          <div style="background: #fffbeb; border: 1px solid #fef3c7; border-left: 3px solid #d97706; padding: 14px 18px; margin: 24px 0; font-size: 12px; color: #92400e; line-height: 1.6;">
            <p style="margin: 0 0 6px 0; font-weight: 700;">Security Notices:</p>
            <ul style="margin: 0; padding-left: 18px;">
              <li>Sign in using your Email and Password above.</li>
              <li>You may change your password anytime from <strong>Profile &gt; Change password</strong>.</li>
              <li>Never share this email or your password with unauthorized individuals.</li>
              <li>If you have any questions, contact <a href="mailto:${replyTo}" style="color: #0B7A63; font-weight: 600;">${replyTo}</a>.</li>
            </ul>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding: 24px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.6;">
          <p style="margin: 0 0 4px 0; font-weight: 600; color: #334155;">Guild Club Services</p>
          <p style="margin: 0; font-size: 11px; color: #94a3b8;">
            Confidential account notification.
          </p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
  `.trim();

  const text = `${subject}
Hello ${toName},

Your ${roleDisplay} account has been created by ${createdByName} on the Guild Club Services platform.

=====================================================
YOUR GUILD CLUB SERVICES LOGIN CREDENTIALS
=====================================================
Portal URL:       ${loginUrl}
Login ID / Email: ${toEmail}
Access Password:  ${passwordDisplay || "(Shared securely by administrator)"}
Role:             ${roleDisplay}
Created By:       ${createdByName}
=====================================================

Sign in: ${loginUrl}

What you can do as ${roleDisplay}:
${whatYouCanDoText}

Security Notices:
- Sign in and change your password from Profile > Change password
- Never share this email or your password
- If you did not expect this email, contact ${replyTo}`;

  return { subject, html, text };
}

/**
 * Sends credentials email directly from the server action with a 5-second timeout.
 * - Respects email quota guard (defers without queuing password).
 * - Never stores or logs plain password in database or outbox.
 * - Records a delivery row in emailQueue / notificationDeliveries.
 * - Creates an in-app welcome notification for the user.
 */
export async function sendCredentialsDirect(
  params: SendCredentialsParams
): Promise<SendCredentialsResult> {
  const { userId, toEmail, toName, role, createdByName, password, emailCredentials = true } = params;

  // Always create the in-app welcome notification for the user (no password inside)
  await db.insert(inAppNotifications).values({
    userId,
    type: role === "admin" ? "admin_account_created" : "account_created",
    title: role === "admin" ? "Welcome, Clinic Admin" : "Welcome, Therapist",
    body: `Your ${role === "admin" ? "Admin" : "Therapist"} account has been activated. For security, please change your temporary password from Profile > Change password.`,
    priority: "normal",
    isRead: false,
    data: {
      role,
      loginId: toEmail,
      createdByName,
    },
  });

  // If checkbox was unchecked, skip email entirely per requirement
  if (!emailCredentials) {
    return { success: true, emailSent: false };
  }

  const env = getEnv();

  // 1. Check email quota guard
  const quota = await getEmailQuotaUsage();
  if (quota.isDailyExceeded || quota.isMonthlyExceeded) {
    // Record failed/deferred delivery row without password
    await db.insert(emailQueue).values({
      toEmail: maskEmail(toEmail),
      toName,
      template: role === "admin" ? "admin_account_created" : "account_created",
      payload: {
        recipientName: toName,
        loginId: toEmail,
        role,
        createdByName,
        passwordIncluded: false,
      },
      status: "deferred",
      lastError: "Daily email limit reached (90 emails/day). Credentials email deferred.",
      priority: 1,
    });

    return {
      success: false,
      emailSent: false,
      quotaExceeded: true,
      error: "Daily email quota reached (90 emails/day). Please share credentials manually or resend later.",
    };
  }

  // 2. Render email (in-memory only)
  const rendered = renderCredentialsEmail({
    toEmail,
    toName,
    role,
    createdByName,
    password,
    includePassword: env.INCLUDE_PASSWORD_IN_EMAIL !== false,
    baseUrl: env.APP_BASE_URL,
    replyTo: env.EMAIL_REPLY_TO || "support@shreespeechhearingandrehabilitation.com",
  });

  const provider = getEmailProvider();
  const templateName = role === "admin" ? "admin_account_created" : "account_created";

  // 3. Send directly with 5-second timeout
  let sendResult: SendEmailResult;
  try {
    const timeoutPromise = new Promise<SendEmailResult>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Email delivery timed out after 5 seconds"));
      }, 5000);
      if (typeof timer.unref === "function") timer.unref();
    });

    const sendPromise = provider.send({
      to: toEmail,
      toName,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      tags: { type: templateName },
    });

    sendResult = await Promise.race([sendPromise, timeoutPromise]);
  } catch (err: any) {
    sendResult = {
      success: false,
      error: { kind: "temporary", message: err?.message || "Delivery timeout" },
    };
  }

  // 4. Create delivery row in email_queue / notification_deliveries WITHOUT password
  await db.insert(emailQueue).values({
    toEmail: maskEmail(toEmail),
    toName,
    template: templateName,
    payload: {
      recipientName: toName,
      loginId: toEmail,
      role,
      createdByName,
      passwordIncluded: env.INCLUDE_PASSWORD_IN_EMAIL,
    },
    status: sendResult.success ? "sent" : "failed",
    sentAt: sendResult.success ? new Date() : null,
    providerMessageId: sendResult.success ? sendResult.providerMessageId : null,
    lastError: sendResult.success ? null : sendResult.error.message,
    priority: 1,
  });

  if (sendResult.success) {
    return {
      success: true,
      emailSent: true,
      providerMessageId: sendResult.providerMessageId,
    };
  } else {
    return {
      success: false,
      emailSent: false,
      error: sendResult.error.message,
    };
  }
}
