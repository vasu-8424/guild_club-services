# Guild Club Services — Real Email & Notification Delivery Guide

This document details the configuration, architecture, notification lifecycle, security models, manual verification steps, and operational troubleshooting for notifications (in-app and email via [Resend](https://resend.com)) in Guild Club Services.

---

## 1. Architecture Overview

```
 [Application Action]
   (e.g., Create Admin/Therapist, Assign Case, Close Case, Complete Session)
          │
          ├───────────────────────────────────────────────────────┐
          ▼                                                       ▼
   [Direct Credentials Send]                              [Atomic DB Transaction]
   (5-second timeout, in-memory password,                         │
    masked recipient, no password in DB)                          ▼
                                                       [Insert `in_app_notifications`]
                                                       (Case Closed, Sessions Grouped,
                                                        Admin/Therapist Created)
                                                                  │
                                                                  ▼
                                                       [Insert `email_queue`]
                                                       (Status: "pending", Priority 1-3)
                                                                  │
                                                                  ▼
                                                [Opportunistic / Cron Queue Processor]
                                                                  │
                                                ├─► 1. Check IST Daily (90) & Monthly (2,800) Limit
                                                │      └─► Exceeded? Defer to 00:00 IST next day
                                                │
                                                ├─► 2. Provider Throttling (~600ms sequential send)
                                                │
                                                ├─► 3. ResendProvider / MockProvider Dispatch
                                                │      ├─► Success: Status = "sent", records messageId
                                                │      ├─► 429 / 5xx: Backoff retry (Max 3 attempts)
                                                │      └─► 4xx: Permanent failure (Status: "failed")
                                                │
                                                ▼
                                    [Optional Resend Webhooks] ──► POST /api/webhooks/resend
                                          ├─► Svix Cryptographic Signature Verification
                                          ├─► Events: delivered, bounced, complained, delivery_delayed
                                          └─► On Bounce / Complaint: Flag `email_undeliverable = true`
```

### Key Safety, Security & Privacy Guarantees
- **No Client PII**: Case notification emails never contain client names, clinical notes, or diagnoses.
- **Zero Password Database Leakage**: Plaintext passwords are never stored in `email_queue`, `notification_deliveries`, `case_events`, or logs. All credentials emails are rendered in ephemeral server action memory. Delivery rows record masked email addresses (e.g., `a***@example.com`).
- **First-Login Security Barrier**: When an admin or therapist is created, their account receives `temporaryPasswordPrompt: true`. A prominent, dismissible banner displays on their dashboard linking to **Profile > Change password**. Once updated, `temporaryPasswordPrompt` is cleared and cannot re-appear.
- **Resend Credentials Rate-Limiting**: Administrators can resend credentials with a newly generated or custom temporary password from the row action menu (`...`), strictly rate-limited to 3 times per hour per user, invalidating prior sessions via `session_version` increments.
- **Fail-Safe Email Dispatch**: Email delivery failures (timeout, API error, domain unverified) **never** block database operations or account creation. If an email fails, the Super Admin receives a warning alert and a one-time copyable modal.
- **Zero Real Email in Automated Tests**: Automated test suites strictly enforce `EMAIL_PROVIDER=mock`. The runtime throws an exception if `resend` is configured in test mode without explicit `ALLOW_REAL_EMAIL_TESTS=true`.
- **Secret Isolation**: Secrets (`RESEND_API_KEY`, `CRON_SECRET`, `RESEND_WEBHOOK_SECRET`) are never logged or committed.

---

## 2. Notification Event Types

| Event Type | Channels | Trigger | Recipients | Payload / Data |
| :--- | :--- | :--- | :--- | :--- |
| `admin_account_created` | In-App & Direct Email | Super Admin creates an Admin (`/super-admin/admins/new`) | New Admin | Role, Login ID, Temporary Password (if enabled), sign-in link, security notices. |
| `account_created` | In-App & Direct Email | Admin registers a Therapist (`/admin/therapists/new`) | New Therapist | Role, Login ID, Temporary Password (if enabled), clinical action guide. |
| `user_credentials_resent` | Direct Email & Audit Log | Super Admin / Admin clicks "Resend credentials" | Target User | New temporary password, sign-in link. Rate-limited to 3/hr. |
| `case_assigned` | In-App & Queued Email | Admin assigns a case to a therapist | Assigned Therapist | Case #, Category, Priority, Assigned By (No patient PII). |
| `case_closed` | In-App & Queued Email | Therapist marks case as completed with outcome | Creating Admin, Assigning Admin (email + in-app); Super Admins (in-app only) | Case #, Therapist Name, Clinical Outcome (`successful`, `unsuccessful`, `referred`), sessions held count, IST closed timestamp. |
| `session_completed_group` | In-App Only | Therapist completes a clinical session | Assigning Admin | Grouped per therapist in a 30-minute window: e.g. `2 sessions completed by Dr. Sharma`. Low priority. |

---

## 3. Environment Configuration

Add the following variables to `.env` (already added to `.env.example`):

| Variable | Description | Default | Required for Resend |
| :--- | :--- | :--- | :--- |
| `EMAIL_PROVIDER` | Active email provider (`resend` or `mock`) | `mock` | Yes (`resend`) |
| `RESEND_API_KEY` | Resend API Key (`re_...`) | — | Yes |
| `EMAIL_FROM_NAME` | Sender display name | `Guild Club Services` | Yes |
| `EMAIL_FROM_ADDRESS` | Sender address on your verified domain | `noreply@guildclubservices.com` | Yes |
| `EMAIL_FROM_DOMAIN` | Verified sending domain | `guildclubservices.com` | Optional (validated) |
| `EMAIL_REPLY_TO` | Optional Reply-To email address | `support@shreespeechhearingandrehabilitation.com` | Optional |
| `EMAIL_DAILY_LIMIT` | IST daily free-tier limit | `90` | Yes |
| `EMAIL_MONTHLY_LIMIT` | IST monthly free-tier limit | `2800` | Yes |
| `APP_BASE_URL` | Root URL for portal redirect links | `http://localhost:3000` | Yes |
| `INCLUDE_PASSWORD_IN_EMAIL` | Include temporary password in credentials emails | `true` | No |
| `NOTIFY_SUPER_ADMINS_ON_CLOSE` | Create in-app notification for Super Admins on case close | `true` | No |
| `NOTIFY_ADMIN_ON_SESSION_COMPLETE` | Create in-app notification when a session is completed | `true` | No |
| `CRON_SECRET` | Secret token protecting `/api/cron/notifications` | `""` | Yes in Production |
| `RESEND_WEBHOOK_SECRET` | Svix signing secret (`whsec_...`) | `""` | Optional for webhooks |
| `ALLOW_REAL_EMAIL_TESTS` | Explicit authorization for real test sends | `false` | No |

---

## 4. Security Tradeoff: Passwords in Email & First-Login Policy

### Why `INCLUDE_PASSWORD_IN_EMAIL` Exists
By default, `INCLUDE_PASSWORD_IN_EMAIL=true` sends the temporary onboarding password directly to the new user's email address. While email is convenient for automated onboarding, email is not an end-to-end encrypted or private channel (mail relays, forwarding rules, and mailbox delegates may expose unencrypted messages).

### The Mitigation Architecture
To balance user onboarding friction with clinical data compliance:
1. **Configurable Toggle**: Organizations requiring strict air-gapped credential transmission can set `INCLUDE_PASSWORD_IN_EMAIL=false`. In this mode, the credentials email omits the password entirely and explicitly instructs the user that their creator will share the temporary password through a secure offline channel.
2. **First-Login Prompt (`temporaryPasswordPrompt: true`)**:
   - Accounts provisioned via admin creation receive `temporaryPasswordPrompt: true`.
   - On signing in, a non-blocking amber banner is displayed across all dashboard views reminding the user to update their temporary credentials.
   - Once the user changes their password at **Profile > Change password** (`/change-password`), the database sets `temporaryPasswordPrompt = false`, removing the banner permanently.
3. **Session Invalidation on Resend**:
   - Resending credentials immediately bumps `session_version` in the database, instantly terminating all existing sessions for that user across devices.

---

## 5. In-App Notification System & Polling

- **Notification Bell**:
  - Located in the top bar across all dashboards.
  - Square unread badge indicates unread notification count.
  - Dropdown lists recent notifications with high-priority and closed-case highlights (green tile with check icon, outcome tag, IST timestamp).
  - Clicking any notification marks it as read and redirects directly to the associated case.
  - "Mark all read" action quickly resets unread counts.
- **20-Second Polling & Case Closure Toasts**:
  - The client polls `pollNotificationsAction` every 20 seconds while the browser tab is active.
  - When a newly closed case is detected, a bottom-right toast surfaces immediately with case number, therapist, and a quick "View case" link.
- **Full Notifications Page (`/notifications` & `/super-admin/notifications`)**:
  - Filter tabs: **All**, **Unread**, and **Closed Cases**.
  - Dropdown filters for **Notification Type** and **Clinical Outcome**.
  - Pagination (10 per page) and bulk read actions.
- **Dashboard "Recently Closed Cases" Card**:
  - Compact widget on Admin and Super Admin dashboards displaying the 5 most recently finalized cases with sharp outcome tags (`Successful`, `Unsuccessful`, `Referred`), therapist name, IST closed date/time, and direct case links.

---

## 6. Manual Verification Checklist

Follow this checklist to verify email delivery, credentials management, and notifications end-to-end:

### Step 1: Run Real-Send Test CLI Script
Send a sample verification email to an inbox you control:
```bash
npm run email:test -- you@example.com
```
- [ ] Confirm output prints `SUCCESS! Test email sent successfully` with a Resend Message ID.
- [ ] Verify the message arrives in your inbox (not spam).
- [ ] Confirm sender reads `Guild Club Services <noreply@yourdomain.com>`.

### Step 2: Super Admin Creates Admin with Credentials Email
1. Sign in as Super Admin (`/super-admin/admins/new`).
2. Fill in Name, Email (inbox you control), Phone (e.g. `9876543210`), and Password.
3. Verify "Email these login details to the admin" is **checked by default** (`data-testid="admin-email-credentials-checkbox"`).
4. Click "Create Admin":
   - [ ] Confirm the one-time credentials modal appears with email and password visible.
   - [ ] Check your inbox: verify "Your Guild Club Services admin account is ready" email arrives.
   - [ ] Verify email contains Login ID, Temporary Password, and "Sign In" button.
   - [ ] Verify email contains NO client PII and lists Admin capabilities.

### Step 3: Admin First Login & Temporary Password Banner Lifecycle
1. Log out and sign in with the newly created Admin's email and temporary password.
2. Confirm you land on `/admin/dashboard`.
   - [ ] Verify the amber banner "For security, please change your temporary password" (`data-testid="temporary-password-banner"`) is visible.
   - [ ] Verify you can navigate the portal freely (the banner is non-blocking).
   - [ ] Click the dismiss `X` button: verify banner disappears for the session.
3. Navigate to **Profile > Change password** (`/change-password`).
4. Enter current temporary password, new password, and confirm new password.
5. Submit form and redirect back to `/admin/dashboard`.
   - [ ] Verify the temporary password banner is **permanently gone** and no longer renders.

### Step 4: Resend Credentials & Rate-Limit Verification
1. Sign in as Super Admin and navigate to `/super-admin/admins`.
2. Find the newly created admin and click `...` > "Resend credentials".
   - [ ] Select "Auto-generate temporary password" and click "Resend Credentials".
   - [ ] Verify one-time dialog displays the new password with Copy button.
   - [ ] Verify credentials email arrives in the admin's inbox with the new password.
   - [ ] Verify previous session of that admin is invalidated immediately.
3. Attempt to resend credentials 3 more times:
   - [ ] Confirm the 4th attempt returns an error: "Rate limit reached (max 3 resends per hour)".

### Step 5: Therapist Completes Case & In-App Notification Flow
1. Sign in as a Therapist assigned to an open case (`/therapist/cases/<id>`).
2. Complete sessions and mark case as closed with outcome "Successful".
3. Sign in as the Admin who created/assigned the case:
   - [ ] Top bar bell shows square unread badge count incremented.
   - [ ] Click bell: dropdown opens showing green check icon, case number, and "Successful" outcome tag.
   - [ ] Click notification item: marks as read and navigates directly to `/admin/cases/<id>`.
   - [ ] Navigate to `/admin/dashboard`: verify "Recently closed cases" card displays the closed case.
   - [ ] Navigate to `/notifications`: verify case appears under "All" and "Closed Cases" tabs.

### Step 6: 30-Minute Session Completed Grouping
1. Therapist marks Session 1 as completed for a case.
   - [ ] Assigning admin receives notification: `Session completed: GCS-XXXX (session 1 of 5) by Dr. Therapist`.
2. Within 30 minutes, therapist marks Session 2 as completed for the same case.
   - [ ] Assigning admin notification is **updated in-place** (no duplicate notification created): `2 sessions completed by Dr. Therapist`.

---

## 7. Webhook Configuration (Optional Delivery Tracking)

To receive real-time delivery confirmations and automatic bounce / complaint flagging:

1. In your **Resend Dashboard**, navigate to **Webhooks** &gt; **Add Webhook**.
2. Set Endpoint URL to:
   ```
   https://your-domain.com/api/webhooks/resend
   ```
3. Subscribe to the following events:
   - `email.delivered`
   - `email.bounced`
   - `email.complained`
   - `email.delivery_delayed`
4. Copy the **Signing Secret** (starts with `whsec_...`).
5. Set `RESEND_WEBHOOK_SECRET="whsec_..."` in your environment variables.
6. The webhook will automatically update `email_queue.status` and flag undeliverable users.

---

## 8. Troubleshooting Reference

| Issue | Root Cause | Solution |
| :--- | :--- | :--- |
| **"EMAIL_FROM_ADDRESS must be on the verified domain"** | `EMAIL_FROM_ADDRESS` domain does not match `EMAIL_FROM_DOMAIN` or Resend domain. | Ensure your sender domain matches the domain verified in your Resend dashboard (e.g. `noreply@guildclubservices.com`). |
| **"RESEND_API_KEY is required"** | `EMAIL_PROVIDER=resend` is set without `RESEND_API_KEY` in `.env`. | Add your valid API key (`re_...`) to `.env` and restart the application. |
| **"429: Too Many Requests"** | Burst send exceeded Resend's free tier rate limit (2 req/sec). | Our queue processor automatically throttles sends to 1 request per ~600ms and retries on 429 with exponential backoff. |
| **"Daily limit reached (90 emails)"** | Resend free tier has a daily limit (~100 emails/day). | Remaining emails are safely moved to status `deferred` and dispatched at 00:00 IST the next day, prioritizing account creation and case assignments. |
| **Emails landing in Spam** | Missing DKIM, SPF, or DMARC DNS records on custom domain. | In the Resend Dashboard under Domains, verify that all DNS records (MX, TXT/DKIM, SPF) show a green "Verified" badge. |
| **"Automated tests must NEVER send real email"** | Playwright or unit tests ran with `EMAIL_PROVIDER=resend`. | Keep `EMAIL_PROVIDER=mock` in `.env.test`. Automated tests will throw unless `ALLOW_REAL_EMAIL_TESTS=true`. |
