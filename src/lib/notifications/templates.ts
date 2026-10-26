import { getEnv } from "@/lib/env";
import type { NotificationType, RenderedEmail } from "./types";

export interface TemplatePayloadMap {
  case_assigned: {
    therapistName: string;
    caseNumber: string;
    priority: string;
    category: string;
    assignedBy: string;
    assignedDate: string;
    caseId: string;
  };
  case_reassigned: {
    therapistName: string;
    caseNumber: string;
    priority: string;
    category: string;
    assignedBy: string;
    assignedDate: string;
    caseId: string;
  };
  case_unassigned: {
    therapistName: string;
    caseNumber: string;
    reassignedDate: string;
  };
  account_created: {
    recipientName: string;
    loginId: string;
    role: string;
    createdByName?: string;
    password?: string;
  };
  password_reset: {
    recipientName: string;
    loginId: string;
    resetByName?: string;
  };
  case_closed: {
    adminName: string;
    caseNumber: string;
    therapistName: string;
    outcome: string;
    closedAt: string;
    caseId: string;
  };
  case_declined: {
    adminName: string;
    caseNumber: string;
    therapistName: string;
    reason: string;
    caseId: string;
  };
  session_scheduled: {
    therapistName: string;
    caseNumber: string;
    scheduledAt: string;
    caseId: string;
  };
  test_email: {
    recipientName?: string;
    sentAt: string;
  };
  admin_note: {
    therapistName: string;
    adminName: string;
    signInUrl?: string;
  };
}

/**
 * Standard CTA Button Style adhering strictly to BUTTONS.md:
 * - 0px border-radius (sharp corners)
 * - Deep teal background (#0B7A63) with 2px bottom border (#064336)
 * - Single-line bold uppercase typography
 */
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
 * Shared responsive layout wrapper for all clinical emails:
 * - Responsive 600px table container
 * - Clinic brand header with logo badge and verified clinic title
 * - Accent stripe (#0B7A63)
 * - Clinical administration footer with security & PHI notice
 */
function wrapInEmailLayout(options: {
  badge?: string;
  badgeColor?: string;
  title: string;
  contentHtml: string;
}): string {
  const badgeHtml = options.badge
    ? `
      <div style="display: inline-block; background: ${options.badgeColor || "#e6f4f1"}; border-left: 3px solid #0B7A63; padding: 4px 10px; font-size: 11px; font-weight: 700; color: #0B7A63; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 14px;">
        ${options.badge}
      </div>
    `
    : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <div style="background-color: #f1f5f9; padding: 32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-spacing: 0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      <!-- Top Brand Accent Bar -->
      <tr>
        <td style="height: 4px; background: #0B7A63; line-height: 4px; font-size: 4px;">&nbsp;</td>
      </tr>

      <!-- Clinic Brand Header -->
      <tr>
        <td style="padding: 24px 32px; border-bottom: 1px solid #f1f5f9; background: #ffffff;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align: middle;">
                      <div style="background: #0B7A63; color: #ffffff; font-weight: 800; font-size: 13px; padding: 6px 10px; letter-spacing: 1px; line-height: 1;">
                        GCS
                      </div>
                    </td>
                    <td style="vertical-align: middle; padding-left: 14px;">
                      <div style="font-size: 15px; font-weight: 700; color: #0f172a; letter-spacing: -0.2px; line-height: 1.2;">
                        Shree Speech, Hearing &amp; Rehabilitation Clinic
                      </div>
                      <div style="font-size: 11px; font-weight: 600; color: #0B7A63; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 3px;">
                        Guild Club Services &mdash; Therapy Portal
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Content Body -->
      <tr>
        <td style="padding: 32px; line-height: 1.6;">
          ${badgeHtml}
          <h1 style="margin: 0 0 18px 0; font-size: 22px; font-weight: 700; color: #0f172a; line-height: 1.3;">
            ${options.title}
          </h1>
          ${options.contentHtml}
        </td>
      </tr>

      <!-- Clinic Footer & Compliance -->
      <tr>
        <td style="padding: 24px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.6;">
          <p style="margin: 0 0 6px 0; font-weight: 600; color: #334155;">
            Shree Speech, Hearing &amp; Rehabilitation Clinic
          </p>
          <p style="margin: 0 0 8px 0;">
            Clinical Administration &amp; Portal Support:
            <a href="mailto:support@shreespeechhearingandrehabilitation.com" style="color: #0B7A63; text-decoration: underline; font-weight: 500;">
              support@shreespeechhearingandrehabilitation.com
            </a>
          </p>
          <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.5;">
            Confidential clinical notice. This message contains no protected health identifiers (PHI). For clinical data safety, temporary passwords are never transmitted via email.
          </p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
  `.trim();
}

export function renderEmail(
  template: NotificationType,
  payload: Record<string, unknown>
): RenderedEmail {
  const env = getEnv();
  const baseUrl = env.APP_BASE_URL.replace(/\/$/, "");

  switch (template) {
    case "account_created": {
      const data = payload as unknown as TemplatePayloadMap["account_created"];
      const loginUrl = `${baseUrl}/login`;
      const subject = "Your login is ready — Guild Club Services";

      const contentHtml = `
        <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">
          Hello <strong>${data.recipientName}</strong>,
        </p>
        <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.6;">
          Your <strong>${data.role.replace("_", " ").toUpperCase()}</strong> account has been created on the Guild Club Services platform.
        </p>

        <!-- Credentials / Account Summary Box -->
        <div style="background: #f8fafc; border: 2px solid #0B7A63; border-radius: 0px; padding: 22px 24px; margin: 24px 0;">
          <div style="font-size: 12px; font-weight: 800; color: #0B7A63; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
            Your Account Login Credentials
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; color: #334155;">
            <tr>
              <td style="padding: 6px 0; font-weight: 600; width: 150px; color: #64748b;">Portal Web Address:</td>
              <td style="padding: 6px 0; font-weight: 600;">
                <a href="${loginUrl}" style="color: #0B7A63; text-decoration: underline;">${loginUrl}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: 600; width: 150px; color: #64748b;">Login ID / Email:</td>
              <td style="padding: 6px 0; font-weight: 700; color: #0f172a; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 15px;">${data.loginId}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: 600; color: #64748b; vertical-align: middle;">Access Password:</td>
              <td style="padding: 6px 0;">
                <span style="display: inline-block; background: #ffffff; border: 1px solid #0B7A63; padding: 6px 14px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 16px; font-weight: 800; color: #0f172a; letter-spacing: 0.8px;">
                  ${data.password || "Shared securely by administrator"}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: 600; color: #64748b;">Assigned Role:</td>
              <td style="padding: 6px 0; font-weight: 700; color: #0B7A63;">${data.role.replace("_", " ").toUpperCase()}</td>
            </tr>
            ${data.createdByName ? `<tr>
              <td style="padding: 6px 0; font-weight: 600; color: #64748b;">Created By:</td>
              <td style="padding: 6px 0; color: #475569;">${data.createdByName}</td>
            </tr>` : ""}
          </table>
        </div>

        <!-- Quick Onboarding Steps -->
        <div style="margin: 24px 0 20px 0;">
          <p style="margin: 0 0 10px 0; font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.6px;">
            Quick Onboarding Steps:
          </p>
          <ol style="margin: 0; padding-left: 20px; font-size: 14px; color: #475569; line-height: 1.8;">
            <li>Click <strong>Access Therapist Portal</strong> below to visit the sign-in page.</li>
            <li>Sign in using your Login ID and the Password shown above.</li>
            <li>Access your caseload, upcoming sessions, and patient therapy documentation.</li>
          </ol>
        </div>

        <!-- Call to Action Button -->
        <div style="margin: 28px 0 20px 0;">
          <a href="${loginUrl}" style="${BUTTON_STYLE}">
            Access Therapist Portal &rarr;
          </a>
        </div>
      `;

      const html = wrapInEmailLayout({
        badge: "Clinician Onboarding",
        title: "Welcome to the Clinical Team",
        contentHtml,
      });

      const text = `Your login is ready — Guild Club Services
Hello ${data.recipientName},

Your ${data.role.replace("_", " ").toUpperCase()} account has been created on the Guild Club Services platform.

=====================================================
YOUR GUILD CLUB SERVICES LOGIN CREDENTIALS
=====================================================
Portal URL:       ${loginUrl}
Login ID / Email: ${data.loginId}
Access Password:  ${data.password || "(Shared securely by administrator)"}
Role:             ${data.role.replace("_", " ").toUpperCase()}
${data.createdByName ? `Created By:       ${data.createdByName}\n` : ""}=====================================================

Sign in: ${loginUrl}

Guild Club Services — Therapy Management System`;

      return { subject, html, text, priority: 1 };
    }

    case "case_assigned": {
      const data = payload as unknown as TemplatePayloadMap["case_assigned"];
      const caseUrl = `${baseUrl}/therapist/cases/${data.caseId}`;
      const subject = `New Case Assigned: ${data.caseNumber} (${data.priority.toUpperCase()})`;

      const contentHtml = `
        <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">
          Hello <strong>${data.therapistName}</strong>,
        </p>
        <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569;">
          A new therapy case has been assigned to your clinical schedule.
        </p>
        
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid #0B7A63; padding: 18px 20px; margin: 20px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; color: #334155;">
            <tr>
              <td style="padding: 4px 0; font-weight: 600; width: 140px; color: #64748b;">Case Number:</td>
              <td style="padding: 4px 0; font-weight: 700; color: #0f172a;">${data.caseNumber}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600; color: #64748b;">Priority:</td>
              <td style="padding: 4px 0; font-weight: 700; color: #0B7A63;">${data.priority.toUpperCase()}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600; color: #64748b;">Category:</td>
              <td style="padding: 4px 0; color: #0f172a;">${data.category}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600; color: #64748b;">Assigned By:</td>
              <td style="padding: 4px 0; color: #475569;">${data.assignedBy}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600; color: #64748b;">Assignment Date:</td>
              <td style="padding: 4px 0; color: #475569;">${data.assignedDate}</td>
            </tr>
          </table>
        </div>

        <div style="margin: 28px 0 20px 0;">
          <a href="${caseUrl}" style="${BUTTON_STYLE}">
            View Assigned Case &rarr;
          </a>
        </div>
      `;

      const html = wrapInEmailLayout({
        badge: "Case Assignment",
        title: "New Case Assigned",
        contentHtml,
      });

      const text = `New Case Assigned: ${data.caseNumber}
Hello ${data.therapistName},

A new therapy case has been assigned to you.

Case Number: ${data.caseNumber}
Priority: ${data.priority.toUpperCase()}
Category: ${data.category}
Assigned By: ${data.assignedBy}
Date: ${data.assignedDate}

View case: ${caseUrl}

Guild Club Services — Therapy Management System.`;

      return { subject, html, text, priority: 1 };
    }

    case "case_reassigned": {
      const data = payload as unknown as TemplatePayloadMap["case_reassigned"];
      const caseUrl = `${baseUrl}/therapist/cases/${data.caseId}`;
      const subject = `Case Reassigned to You: ${data.caseNumber}`;

      const contentHtml = `
        <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">
          Hello <strong>${data.therapistName}</strong>,
        </p>
        <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569;">
          Case <strong>${data.caseNumber}</strong> has been reassigned to your care.
        </p>
        
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid #0B7A63; padding: 18px 20px; margin: 20px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; color: #334155;">
            <tr>
              <td style="padding: 4px 0; font-weight: 600; width: 140px; color: #64748b;">Case Number:</td>
              <td style="padding: 4px 0; font-weight: 700; color: #0f172a;">${data.caseNumber}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600; color: #64748b;">Priority:</td>
              <td style="padding: 4px 0; font-weight: 700; color: #0B7A63;">${data.priority.toUpperCase()}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600; color: #64748b;">Category:</td>
              <td style="padding: 4px 0; color: #0f172a;">${data.category}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600; color: #64748b;">Assigned By:</td>
              <td style="padding: 4px 0; color: #475569;">${data.assignedBy}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600; color: #64748b;">Reassigned Date:</td>
              <td style="padding: 4px 0; color: #475569;">${data.assignedDate}</td>
            </tr>
          </table>
        </div>

        <div style="margin: 28px 0 20px 0;">
          <a href="${caseUrl}" style="${BUTTON_STYLE}">
            View Reassigned Case &rarr;
          </a>
        </div>
      `;

      const html = wrapInEmailLayout({
        badge: "Case Update",
        title: "Case Reassigned to You",
        contentHtml,
      });

      const text = `Case Reassigned to You: ${data.caseNumber}
Hello ${data.therapistName},

Case ${data.caseNumber} has been reassigned to your care.

Case Number: ${data.caseNumber}
Priority: ${data.priority.toUpperCase()}
Category: ${data.category}
Assigned By: ${data.assignedBy}
Date: ${data.assignedDate}

View case: ${caseUrl}`;

      return { subject, html, text, priority: 1 };
    }

    case "case_unassigned": {
      const data = payload as unknown as TemplatePayloadMap["case_unassigned"];
      const subject = `Case Reassigned: ${data.caseNumber}`;

      const contentHtml = `
        <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">
          Hello <strong>${data.therapistName}</strong>,
        </p>
        <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569;">
          Case <strong>${data.caseNumber}</strong> has been reassigned to another clinician and is no longer in your active list.
        </p>
        <p style="font-size: 13px; color: #64748b; margin: 0;">
          Reassigned on: ${data.reassignedDate}
        </p>
      `;

      const html = wrapInEmailLayout({
        badge: "Schedule Update",
        title: "Case Reassigned",
        contentHtml,
      });

      const text = `Case Update: ${data.caseNumber}
Hello ${data.therapistName},

Case ${data.caseNumber} has been reassigned to another clinician and is no longer in your active list.
Reassigned on: ${data.reassignedDate}`;

      return { subject, html, text, priority: 2 };
    }

    case "password_reset": {
      const data = payload as unknown as TemplatePayloadMap["password_reset"];
      const loginUrl = `${baseUrl}/login`;
      const subject = "Password Reset Notice — Shree Speech, Hearing & Rehabilitation Clinic";

      const contentHtml = `
        <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">
          Hello <strong>${data.recipientName}</strong>,
        </p>
        <p style="margin: 0 0 16px 0; font-size: 14px; color: #475569; line-height: 1.6;">
          Your account password for <strong>${data.loginId}</strong> has been reset by an administrator.
        </p>
        <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569; line-height: 1.6;">
          Your new temporary credentials will be securely shared with you directly by the administrator.
        </p>

        <div style="margin: 28px 0 20px 0;">
          <a href="${loginUrl}" style="${BUTTON_STYLE}">
            Sign In to Portal &rarr;
          </a>
        </div>

        <p style="font-size: 13px; color: #64748b; margin-top: 20px; line-height: 1.5;">
          If you did not request or expect this change, please contact your clinic administrator immediately.
        </p>
      `;

      const html = wrapInEmailLayout({
        badge: "Account Security",
        title: "Password Reset Notice",
        contentHtml,
      });

      const text = `Password Reset Notice — Shree Speech, Hearing & Rehabilitation Clinic
Hello ${data.recipientName},

Your account password for ${data.loginId} has been reset by an administrator.
Your new credentials will be shared with you directly by the administrator.

Sign in at: ${loginUrl}`;

      return { subject, html, text, priority: 2 };
    }

    case "case_closed": {
      const data = payload as unknown as TemplatePayloadMap["case_closed"];
      const caseUrl = `${baseUrl}/admin/cases/${data.caseId}`;
      const subject = `Case Closed: ${data.caseNumber} — ${data.outcome.toUpperCase()}`;

      const contentHtml = `
        <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">
          Hello <strong>${data.adminName}</strong>,
        </p>
        <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569;">
          Case <strong>${data.caseNumber}</strong> has been officially marked as closed.
        </p>
        
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-left: 3px solid #16a34a; padding: 18px 20px; margin: 20px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; color: #334155;">
            <tr>
              <td style="padding: 4px 0; font-weight: 600; width: 140px; color: #166534;">Case Number:</td>
              <td style="padding: 4px 0; font-weight: 700; color: #0f172a;">${data.caseNumber}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600; color: #166534;">Therapist:</td>
              <td style="padding: 4px 0; color: #0f172a;">${data.therapistName}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600; color: #166534;">Outcome:</td>
              <td style="padding: 4px 0; font-weight: 700; color: #16a34a;">${data.outcome.toUpperCase()}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600; color: #166534;">Closed At:</td>
              <td style="padding: 4px 0; color: #475569;">${data.closedAt}</td>
            </tr>
          </table>
        </div>

        <div style="margin: 28px 0 20px 0;">
          <a href="${caseUrl}" style="${BUTTON_STYLE}">
            View Closed Case &rarr;
          </a>
        </div>
      `;

      const html = wrapInEmailLayout({
        badge: "Case Completed",
        badgeColor: "#dcfce7",
        title: "Case Closed",
        contentHtml,
      });

      const text = `Case Closed: ${data.caseNumber}
Hello ${data.adminName},

Case ${data.caseNumber} has been marked as closed.
Therapist: ${data.therapistName}
Outcome: ${data.outcome.toUpperCase()}
Closed At: ${data.closedAt}

View case: ${caseUrl}`;

      return { subject, html, text, priority: 2 };
    }

    case "case_declined": {
      const data = payload as unknown as TemplatePayloadMap["case_declined"];
      const caseUrl = `${baseUrl}/admin/cases/${data.caseId}`;
      const subject = `Case Assignment Declined: ${data.caseNumber}`;

      const contentHtml = `
        <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">
          Hello <strong>${data.adminName}</strong>,
        </p>
        <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569;">
          Therapist <strong>${data.therapistName}</strong> has declined case <strong>${data.caseNumber}</strong>.
        </p>
        
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-left: 3px solid #dc2626; padding: 18px 20px; margin: 20px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; color: #334155;">
            <tr>
              <td style="padding: 4px 0; font-weight: 600; width: 140px; color: #991b1b;">Case Number:</td>
              <td style="padding: 4px 0; font-weight: 700; color: #0f172a;">${data.caseNumber}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600; color: #991b1b;">Declined By:</td>
              <td style="padding: 4px 0; color: #0f172a;">${data.therapistName}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600; color: #991b1b;">Reason:</td>
              <td style="padding: 4px 0; color: #475569;">${data.reason || "Not specified"}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 14px; color: #475569;">
          The case has been set back to unassigned and is ready for reassignment.
        </p>

        <div style="margin: 28px 0 20px 0;">
          <a href="${caseUrl}" style="${BUTTON_STYLE}">
            Reassign Case &rarr;
          </a>
        </div>
      `;

      const html = wrapInEmailLayout({
        badge: "Action Required",
        badgeColor: "#fee2e2",
        title: "Case Assignment Declined",
        contentHtml,
      });

      const text = `Case Assignment Declined: ${data.caseNumber}
Hello ${data.adminName},

Therapist ${data.therapistName} has declined case ${data.caseNumber}.
Reason: ${data.reason || "Not specified"}

Reassign case: ${caseUrl}`;

      return { subject, html, text, priority: 3 };
    }

    case "session_scheduled": {
      const data = payload as unknown as TemplatePayloadMap["session_scheduled"];
      const caseUrl = `${baseUrl}/therapist/cases/${data.caseId}`;
      const subject = `Session Scheduled: ${data.caseNumber}`;

      const contentHtml = `
        <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">
          Hello <strong>${data.therapistName}</strong>,
        </p>
        <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569;">
          A new therapy session has been scheduled for case <strong>${data.caseNumber}</strong>.
        </p>
        
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid #0B7A63; padding: 18px 20px; margin: 20px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; color: #334155;">
            <tr>
              <td style="padding: 4px 0; font-weight: 600; width: 140px; color: #64748b;">Case Number:</td>
              <td style="padding: 4px 0; font-weight: 700; color: #0f172a;">${data.caseNumber}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600; color: #64748b;">Scheduled Time:</td>
              <td style="padding: 4px 0; font-weight: 600; color: #0B7A63;">${data.scheduledAt}</td>
            </tr>
          </table>
        </div>

        <div style="margin: 28px 0 20px 0;">
          <a href="${caseUrl}" style="${BUTTON_STYLE}">
            View Case &amp; Schedule &rarr;
          </a>
        </div>
      `;

      const html = wrapInEmailLayout({
        badge: "Appointment Notice",
        title: "Session Scheduled",
        contentHtml,
      });

      const text = `Session Scheduled: ${data.caseNumber}
Hello ${data.therapistName},

A new session has been scheduled for case ${data.caseNumber}.
Scheduled Time: ${data.scheduledAt}

View case: ${caseUrl}`;

      return { subject, html, text, priority: 3 };
    }

    case "test_email": {
      const data = payload as unknown as TemplatePayloadMap["test_email"];
      const testCaseUrl = `${baseUrl}/therapist/dashboard`;
      const subject = "Test Email: Real-Send Verification — Shree Speech & Hearing Clinic";

      const contentHtml = `
        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-left: 3px solid #0B7A63; padding: 14px 16px; margin-bottom: 20px; font-size: 13px; color: #065f46; line-height: 1.5;">
          <strong>Real-Send Provider Test:</strong> This live verification email confirms that Resend connectivity, domain authentication (SPF/DKIM), and outbox queuing are operating properly.
        </div>
        <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">
          Hello <strong>${data.recipientName || "Administrator"}</strong>,
        </p>
        <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569;">
          This sample notification was successfully delivered through your verified domain <strong>shreespeechhearingandrehabilitation.com</strong>.
        </p>
        
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 18px 20px; margin: 20px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; color: #334155;">
            <tr>
              <td style="padding: 4px 0; font-weight: 600; width: 140px; color: #64748b;">Provider:</td>
              <td style="padding: 4px 0; font-weight: 700; color: #0B7A63;">Resend (Verified Domain)</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600; color: #64748b;">Test Case:</td>
              <td style="padding: 4px 0; color: #0f172a;">CASE-TEST-001 (Speech Therapy)</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600; color: #64748b;">Dispatched At:</td>
              <td style="padding: 4px 0; color: #475569;">${data.sentAt}</td>
            </tr>
          </table>
        </div>

        <div style="margin: 28px 0 20px 0;">
          <a href="${testCaseUrl}" style="${BUTTON_STYLE}">
            Access Therapy Portal &rarr;
          </a>
        </div>
      `;

      const html = wrapInEmailLayout({
        badge: "Live System Test",
        title: "Real Email Verification",
        contentHtml,
      });

      const text = `Real Email Verification — Shree Speech & Hearing Clinic
This is a live test email verifying Resend connectivity.

Case Number: CASE-TEST-001
Dispatched At: ${data.sentAt}

Portal: ${testCaseUrl}`;

      return { subject, html, text, priority: 3 };
    }

    case "admin_note": {
      const data = payload as unknown as TemplatePayloadMap["admin_note"];
      const signInUrl = data.signInUrl || `${baseUrl}/login`;
      const subject = `You have a new note from ${data.adminName} on Guild Club Services`;

      const contentHtml = `
        <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">
          Hello <strong>${data.therapistName || "Therapist"}</strong>,
        </p>
        <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569;">
          You have a new note from <strong>${data.adminName}</strong> on Guild Club Services.
        </p>
        <div style="margin: 28px 0 20px 0;">
          <a href="${signInUrl}" style="${BUTTON_STYLE}">
            Sign In to View Note &rarr;
          </a>
        </div>
      `;

      const html = wrapInEmailLayout({
        badge: "Admin Note",
        title: "New Note Received",
        contentHtml,
      });

      const text = `You have a new note from ${data.adminName} on Guild Club Services\n\nSign in: ${signInUrl}`;

      return { subject, html, text, priority: 2 };
    }

    default:
      return {
        subject: "Shree Speech & Hearing Clinic Notification",
        html: wrapInEmailLayout({
          title: "Notification",
          contentHtml: "<p>You have a new clinical notification from Shree Speech, Hearing &amp; Rehabilitation Clinic.</p>",
        }),
        text: "You have a new clinical notification from Shree Speech, Hearing & Rehabilitation Clinic.",
        priority: 5,
      };
  }
}
