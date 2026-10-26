# Guild Club Services — Therapy Case Management Portal

**Guild Club Services** is an enterprise-grade therapy case management portal designed for specialized clinical practices, therapists, and healthcare administration teams.

This codebase contains **Stage 1 (Core Foundation, Neon PostgreSQL, Drizzle ORM, Role-Based JWT Auth)** and **Stage 2 (Clinical Operations, User Provisioning, Case Management, Therapist Caseloads, and Email Queue System)**.

---

## 🏗️ Architecture & Technology Stack

- **Framework**: Next.js 16 (App Router, Server Actions, TypeScript)
- **Styling**: Tailwind CSS & shadcn/ui design patterns
- **Database**: [Neon](https://neon.tech) Serverless PostgreSQL
- **ORM & Migrations**: Drizzle ORM (`drizzle-orm` + `drizzle-kit`)
- **Authentication**: Stateless, tamper-proof session tokens signed with JWT (`jose`) in `httpOnly`, `secure`, `SameSite=Lax` cookies
- **Security & Password Hashing**: `bcryptjs` (salt rounds = 10)
- **Validation**: Schema-level type inference and request validation using `zod`
- **Email System**: [Resend](https://resend.com) with database-backed queue, retry backoff, and dev console fallback
- **Case Numbering**: Concurrency-safe `GCS-YYYY-NNNN` sequence generation via `SELECT ... FOR UPDATE`
- **Timezone**: `Asia/Kolkata` with `date-fns` & `date-fns-tz`

---

## 👥 Roles & Access Scopes

Guild Club Services enforces strict Role-Based Access Control (RBAC):

| Role | Access Scope | Designated Portal / Routes |
| :--- | :--- | :--- |
| `super_admin` | Global clinical oversight, Admin account management, therapist directory, all cases, system audits | `/super-admin/dashboard`<br>`/super-admin/admins`<br>`/admin/*` |
| `admin` | Case intake, client registration, therapist assignments & capacity management, session tracking | `/admin/dashboard`<br>`/admin/cases`<br>`/admin/therapists` |
| `therapist` | Assigned client caseload, case accept/decline, clinical progress notes, therapy session logs | `/therapist/dashboard`<br>`/therapist/cases/[id]` |

> **Security Policy**: Guild Club Services is an internal, invite-only clinic portal. **There is NO public registration.** All accounts are provisioned by an authorized administrator or generated during initial database seeding.

---

## 📋 Stage 2 Core Operations

### 1. Super Admin: Admin Management (`/super-admin/admins`)
- **Create Administrator**: Generates a cryptographically secure 12-character temporary password (`crypto.randomBytes`), sets `must_change_password = true`, hashes with `bcrypt`, and queues an `admin_credentials` welcome email.
- **Edit Administrator**: Update name and contact phone.
- **Activate / Deactivate**: Toggles account status. Deactivated administrators are immediately barred from sign-in and session cookies are revoked.
- **Transactional Audit Events**: `admin_created`, `admin_updated`, `user_activated`, `user_deactivated`.

### 2. Admin & Super Admin: Therapist Management (`/admin/therapists`)
- **Therapist Directory**: Lists all practitioners, specialization, experience years, current open cases vs. maximum capacity (`openCases / maxOpenCases`), and active status.
- **Register Practitioner**: Creates therapist user account and `therapist_profiles` record in an atomic transaction, generates a temporary password, and queues a `therapist_credentials` email.
- **Workload Warnings**: Highlights therapists currently at or over capacity.
- **Edit & Status Toggling**: Update specialization, capacity limits, and active status.

### 3. Case Intake & Management (`/admin/cases`)
- **Intake Form (`/admin/cases/new`)**: Registers the client demographic details and creates the clinical case with concurrency-safe `GCS-YYYY-NNNN` sequencing.
- **Optional Immediate Assignment**: Allows selecting an active practitioner during intake, warning if the practitioner is at capacity.
- **Case Directory & Filters**: Filter by Status (`new`, `assigned`, `accepted`, `in_progress`, `on_hold`, `completed`), Priority (`urgent`, `high`, `medium`, `low`), and full-text search by case number or client name.
- **Case Detail (`/admin/cases/[id]`)**: Full clinical view with assignment controls, status advancement, session scheduler, confidential notes timeline, and complete audit event log.

### 4. Therapist Caseload Portal (`/therapist/dashboard`)
- **Case Assignment Invitations**: Prominently displays cases awaiting practitioner acceptance.
  - **Accept**: Moves case status to `accepted` and logs `case_accepted` event.
  - **Decline**: Requires a mandatory clinical rationale (minimum 10 characters), clears the practitioner assignment, returns the case to `new` status, and dispatches a `case_declined` alert to the intake admin.
- **Case Detail (`/therapist/cases/[id]`)**: Clinical view for assigned practitioners to log therapy sessions, add confidential clinical notes, advance status to `in_progress` or `on_hold`, and close cases upon discharge.
- **Close Case**: Requires choosing a clinical outcome (`successful`, `unsuccessful`, `referred`), sets `closed_at`, logs `case_closed` event, and notifies the clinic administration.

### 5. Email Queue System & Password Reset
- **Email Queue Table (`email_queue`)**: Atomic enqueueing inside data mutation transactions via `queueEmail(tx, params)`.
- **Worker / API Route (`/api/email/process`)**: Processes pending emails in batches with `SELECT ... FOR UPDATE SKIP LOCKED` and a 3-attempt retry limit.
- **Templates**:
  - `admin_credentials`: Welcome email with login link and temporary password
  - `therapist_credentials`: High-clarity welcome email with Login ID, Access Password, and direct portal link
  - `case_assigned`: *(Removed per clinical workflow directive: therapists create cases and assign to themselves)*
  - `case_declined`: Alert to intake admin with practitioner's decline rationale
  - `case_closed`: Final discharge notice with outcome
  - `password_reset`: 30-minute time-limited reset link
- **Password Reset Flow**: `/forgot-password` requests a token, `/reset-password?token=...` securely consumes it and updates the password hash.

---

## 📜 Audit Event Reference

Every state mutation calls `recordEvent(tx, params)` inside the **same database transaction** as the data modification:

| Event Type | Trigger | Target Entity | Metadata Recorded |
| :--- | :--- | :--- | :--- |
| `admin_created` | Super Admin creates an admin | Target User ID | `email`, `name` |
| `admin_updated` | Super Admin edits an admin | Target User ID | `name`, `phone` |
| `therapist_registered` | Admin registers a therapist | Target User ID | `specialization`, `experienceYears`, `maxOpenCases` |
| `therapist_updated` | Admin edits a therapist | Target User ID | `specialization`, `experienceYears`, `maxOpenCases` |
| `user_activated` | Admin or Super Admin activates account | Target User ID | `newStatus: true` |
| `user_deactivated` | Admin or Super Admin deactivates account | Target User ID | `newStatus: false` |
| `case_created` | Case intake submitted | Case ID | `caseNumber`, `clientName`, `category`, `priority` |
| `case_assigned` | Case assigned to practitioner | Case ID + Target User | `therapistName`, `notes` |
| `case_reassigned` | Case reassigned to different therapist | Case ID + Target User | `previousTherapistId`, `therapistName` |
| `case_accepted` | Therapist accepts assigned case | Case ID | `fromStatus: "assigned"`, `toStatus: "accepted"` |
| `case_declined` | Therapist declines assignment | Case ID | `reason`, `therapistName` |
| `status_changed` | Case status advanced | Case ID | `fromStatus`, `toStatus`, `notes` |
| `case_closed` | Case finalized & discharged | Case ID | `outcome`, `closingNotes`, `closedAt` |
| `note_added` | Clinical or intake note posted | Case ID | `noteSnippet`, `isPrivate` |
| `session_scheduled` | Therapy appointment scheduled | Case ID | `sessionId`, `scheduledAt`, `durationMinutes` |
| `session_held` | Session marked as held | Case ID | `sessionId`, `status: "held"` |
| `session_missed` | Session marked as missed | Case ID | `sessionId`, `status: "missed"` |
| `session_cancelled` | Session marked as cancelled | Case ID | `sessionId`, `status: "cancelled"` |
| `password_reset_requested` | Forgot password submitted | Target User ID | `email` |
| `password_reset_completed` | New password set via token | Target User ID | — |

---

## ⚡ Setup & Installation Steps

### 1. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Ensure `.env` contains your Neon database strings and application configuration:
```env
DATABASE_URL="postgresql://<user>:<password>@<endpoint>-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://<user>:<password>@<endpoint>.us-east-2.aws.neon.tech/neondb?sslmode=require"
AUTH_SECRET="your-secure-random-auth-secret-key-32-characters-minimum"
APP_TIMEZONE="Asia/Kolkata"
EMAIL_FROM="Guild Club Services <noreply@guildclubservices.com>"
RESEND_API_KEY="re_sample_key"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 2. Apply Database Migrations
```bash
npm run db:migrate
```

### 3. Seed Initial Accounts
```bash
npm run db:seed
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

---

- `npm run dev`: Starts the Next.js development server.
- `npm run build`: Type-checks and creates the production bundle.
- `npm run lint`: Runs ESLint checks.
- `npm run db:generate`: Generates SQL migration files using Drizzle Kit.
- `npm run db:migrate`: Executes migrations against Neon unpooled database.
- `npm run db:seed`: Seeds initial Super Admin, Admin, and Therapist accounts.
- `npm run db:seed:stage3`: Seeds 30 demo cases and 570+ audit events across 30 days including near-midnight IST events.
- `npm run test:stage3`: Runs Playwright Stage 3 Date-Wise Dashboards and Analytics suite.
- `npm run test:stage2`: Runs Playwright Stage 2 Clinical Operations suite.
- `npm run test:all`: Runs the complete end-to-end regression suite (114 tests).

---

## 📊 Stage 3 Date-Wise Dashboards & Analytics

### 1. Unified Date Selector Component
- Located in the top bar of every authenticated portal.
- Default view is **Today** (`Asia/Kolkata` timezone).
- Presets: **Today**, **Yesterday**, **Last 7 days**, **Custom Date**, and **Custom Range**.
- **URL-First State**: Selections update the query parameters (`?date=YYYY-MM-DD` or `?from=YYYY-MM-DD&to=YYYY-MM-DD`), enabling bookmarking, sharing, and browser back/forward navigation.
- **Strict Asia/Kolkata Boundaries**: All queries enforce PostgreSQL timezone conversion:
  ```sql
  occurred_at >= ($1::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
  AND occurred_at < (($1::date + 1))::timestamp AT TIME ZONE 'Asia/Kolkata'
  ```
- **Historical Viewing Safety**: Selecting any past date renders a prominent amber banner:
  `Viewing history (read-only) — Showing clinical state and events recorded on [Date]`
- **No-Activity Empty State**: Days with zero clinical events display:
  `No activity on this date — No clinical events, intake, notes, or sessions were recorded.`

### 2. Zero-Log Philosophy: The Drill-Down Drawer
In compliance with the core design rule, **there is NO raw activity log screen anywhere in the application**.
Instead, every metric card, staff card, and case movement row is clickable. Clicking immediately slides out a **Drill-Down Drawer** showing:
- Exact timestamps in 12-hour IST (`hh:mm:ss a`)
- Entity links (case numbers, actor badges)
- Event type badges (`case_created`, `session_held`, `case_closed`, etc.)
- Metadata previews (session details, decline rationales, clinical notes, discharge outcomes)
- Client-side search and filtering across the day's actions

### 3. Role-Scoped Portals
- **Super Admin (`/super-admin/dashboard`)**:
  - Global KPI cards (Intake, Assigned, Accepted, Declined, Sessions Held, Discharged, Day Success Rate, Success Rate to Date).
  - Staff Performance Cards: Narrative summaries for every Administrator and Therapist (e.g. *"Created 5 cases, assigned 4"* or *"Held 3 sessions, closed 1 case"*).
  - Case Movements List: Direct tracking of all case transitions that occurred on that date.
  - Interactive Visualizations: Case status donut chart, category breakdown bar chart, and therapist workload distribution (Recharts).
- **Admin (`/admin/dashboard`)**:
  - Admin's own intake and assignment counts for that date.
  - Unassigned cases backlog as of that date (derived from each case's latest event on or before that date).
  - Registered practitioners directory with capacity counters.
  - Therapist work summary cards with click-to-drilldown.
- **Therapist (`/therapist/dashboard`)**:
  - Strictly limited to practitioner's own caseload.
  - Caseload overview (Assigned, Accepted, Declined, Sessions Held, Notes Logged, Cases Closed).
  - Read-only historical viewing mode for review of past therapy sessions and clinical notes.

### 4. Super Admin Analytics & Reports (`/super-admin/reports`)
- Comprehensive clinical intelligence accessible only to `super_admin`:
  - **Clinical Success Rate**: `successful closures / total closures` (Overall, Per Therapist, and Monthly Trends).
  - **Resolution Time**: Average days from intake to discharge.
  - **Practitioner Acceptance Time**: Average hours/days from assignment to practitioner acceptance.
  - **Reassignment Rate**: Percentage of cases transferred between practitioners.
  - **Distribution Charts**: Cases by Clinical Category, Priority Distribution, and Monthly Inflow.
- **Reporting Engine**:
  - Date Range Filtering.
  - **Excel Export (`.xlsx`)**: Multi-sheet workbook (`Summary & KPIs`, `Therapist Performance`, `Category Breakdown`, `Monthly Trends`).
  - **PDF Export (`.pdf`)**: Clinical intelligence summary report with structured tables and styling.

---

## 🔒 Security & Route Hardening Review

- **Zero-Trust Role Enforcement**: All dashboard API endpoints (`/api/dashboard/*`) and server actions execute `getCurrentUser()` and verify role authorization.
- **Therapist Isolation Guarantee**: In `/api/dashboard/drilldown`, any request from a `therapist` forces `actorId = user.id`. Query parameter overrides are ignored.
- **Index Optimization**: Added compound indexes on `case_events` (`(event_type, occurred_at)` and `(to_status, occurred_at)`) ensuring sub-millisecond query execution over high-volume audit logs.
- **Midnight Boundary Partitioning**: Seeded and tested events at 23:58:00 IST and 00:03:00 IST to ensure zero bleed across calendar days.

---

## 🚀 Vercel Production Deployment Guide

### 1. Prerequisites
- A GitHub repository with this codebase pushed.
- A [Vercel](https://vercel.com) account.
- A [Neon](https://neon.tech) serverless PostgreSQL project with connection pooling enabled.

### 2. Environment Variables Configuration
In your Vercel Project Settings > **Environment Variables**, configure the following:

| Variable Name | Description | Example / Recommended Value |
| :--- | :--- | :--- |
| `DATABASE_URL` | Neon **Pooled** Connection String (used by serverless Next.js lambdas) | `postgresql://user:pass@ep-xyz-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require` |
| `DATABASE_URL_UNPOOLED` | Neon **Direct/Unpooled** Connection String (used for Drizzle migrations) | `postgresql://user:pass@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require` |
| `AUTH_SECRET` | 32+ character secure secret for JWT session encryption | Generate with `openssl rand -base64 32` |
| `APP_TIMEZONE` | Clinic operational timezone | `Asia/Kolkata` |
| `EMAIL_FROM` | Verified sender email address | `Guild Club Services <noreply@guildclubservices.com>` |
| `RESEND_API_KEY` | Resend API key for outbound transactional emails | `re_123456789...` |
| `NEXT_PUBLIC_APP_URL` | Production deployment URL | `https://your-domain.vercel.app` |

### 3. Build & Deployment Settings
- **Framework Preset**: Next.js
- **Root Directory**: `./`
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

### 4. Database Migration & Initial Seeding
Before your first traffic cutover, run migrations and seeding against the production Neon database from your terminal:
```bash
# 1. Apply Drizzle migrations (uses DATABASE_URL_UNPOOLED)
npm run db:migrate

# 2. Seed initial Super Admin and foundational accounts
npm run db:seed
```

---

## 🩺 Simplified Therapist Workflow

Guild Club Services includes a simplified, clinically-focused therapist experience designed for ease of use on mobile devices and desktop workstations, following a strict 0px border-radius (`rounded-none`) design system and `#0B7A63` brand color.

### 1. Therapist Shift Login & Geolocation Recording
- **Shift Location Prompt**: Upon signing into `/login`, therapists are prompted for shift location capture.
- **GPS Coordinates**: Records exact `latitude`, `longitude`, `accuracy` (meters), client IP, and `logged_in_at` timestamp into `login_records`.
- **Policy Enforcement**: Controlled by the `REQUIRE_LOCATION_ON_LOGIN` environment flag (`true` enforces capture or denied logging).
- **Privacy Assurance**: Geolocation coordinates are strictly access-controlled. They are **never sent via email or SMS**.
- **Admin Audit**: Clinic administrators can review login activity and view map pins directly via OpenStreetMap (`https://www.openstreetmap.org/?mlat=LAT&mlon=LNG#map=17/LAT/LNG`).

### 2. Therapist-Only Case Creation & Automatic Self-Assignment
- **Therapist Exclusivity**: Cases are initiated directly by treating therapists from `/therapist/dashboard` via the `+ Create Case` button. Admin case creation is hidden and blocked with HTTP 403 Forbidden.
- **Demographics & Intake**: Captures patient name, age (0–120), sex (`male`, `female`, `other`), clinical problem, present condition, room number, and facility branch.
- **Three Supported Clinical Services**:
  - `physiotherapy` — Physiotherapy
  - `swallow_therapy` — Swallow Therapy
  - `vitalstim_therapy` — VitalStim Therapy
- **Joining Condition Photos**: 1 to 3 mandatory baseline intake photos with direct device camera capture (`capture="environment"`), image preview, and removal capabilities (JPEG, PNG, WebP up to 5MB).
- **Consent Verification**: Requires explicit patient/guardian consent confirmation.
- **Atomic Concurrency-Safe Generation**: Automatically generates a unique sequential patient ID (`GCP-XXXX`) and case reference number (`GCS-YYYY-NNNN`) within a single database transaction.
- **Zero Admin Burden**: Automatically assigns the case to the creating therapist (`currentTherapistId = therapist.id`) and logs a `case_created` in-app notification to all administrators (`"<Therapist> created case GCP-XXXX"`).

### 3. Month Calendar on Case Page
- **Boundary Navigation**: Calendar bounds strictly between case `startDate` and `closedAt` (or today IST). Previous and Next month buttons disable at boundaries.
- **Color-Coded Statuses**:
  - 🟢 **Green (Session Done)**: A clinical session was recorded. Clicking opens the session note and attached photo.
  - 🔴 **Red (Missed)**: Past day or today without session. Clicking opens an informational modal: *"No session was recorded on this day. Clinical sessions can only be recorded on the day they occur."*
  - ⚪ **Gray (Future)**: Days after today are disabled and unclickable.
  - 🔵 **Blue Outline (Today)**: Highlights current date in Asia/Kolkata timezone. Clicking opens the session recording modal.
- **Counters**: Displays aggregate **Sessions Done**, **Missed Days**, and **Attendance %** directly above the calendar.

### 4. Daily Session Logging
- **Today Only**: Sessions can only be logged for today (Asia/Kolkata) and are editable until midnight IST. Past days cannot be recorded retroactively.
- **Clinical Validation**: Minimum 10 characters required for session notes.
- **Photo Upload**: Optional photo attachment from device camera.
- **Instant UI Reactivity**: Calendar day cell updates immediately to green without requiring a full page refresh.
- **Grouped Admin Notification**: Batched low-priority notification dispatches to admins.

### 5. Discharge & Case Closure (Mandatory Final Progress Report)
- **Outcome Mapping**:
  - `Improved` ➔ `successful`
  - `Partially improved` ➔ `successful`
  - `No change` ➔ `unsuccessful`
  - `Referred` ➔ `referred`
- **Mandatory Final Report**: Case closure requires the therapist to author the patient's final progress evaluation in words (Current Condition min 10 chars, Progress Since Last Report min 20 chars, Treatment Given & Plan Ahead, Remarks).
- **Present Condition Photos**: Requires 1 to 3 present condition photos showing the patient's status upon discharge.
- **Confirmation Safeguard**: Two-step modal requiring explicit review and confirmation:
  > *"Close case GCP-XXXX? You cannot add sessions after closing."*
- **Database Unique Constraint**: Enforced by a partial unique index on `(case_id) WHERE report_type = 'final'` ensuring exactly one final report per case.
- **Read-Only Lock**: Once closed, status permanently updates to `Closed`, and the case and all progress reports are permanently locked.

### 6. Clinical Progress Reports & Printable Report Page
- **Route**: Accessible at `/cases/[id]/report` (with backwards-compatible redirects from `/therapist/cases/[id]/report` and `/admin/cases/[id]/report`).
- **Authorization**: Owning therapist, Admins, and Super Admins. Other therapists receive a 404 Not Found.
- **Top-to-Bottom Layout**:
  1. **Header**: Patient ID, patient name, age, sex, service, problem, branch, room, start date, end date or "Ongoing", and status.
  2. **Facts Strip**: System-calculated numbers only: Sessions Done, Missed Days, Attendance %.
  3. **Visual Progression Photos**: Joining condition photo (intake) and present condition photo (discharge), side by side with capture dates.
  4. **Therapist's Report**: Submitted narrative reports in chronological order, displaying exact words, preserved line breaks, date & time, type tag ("Progress Update" or "Final Report"), author's name, and `(edited)` badge if prior versions exist.
  5. **Session Notes Timeline**: Chronological log of daily notes recorded during held appointments.
  6. **Discharge Outcome & Closing Summary**: Rendered once the case is closed.
  7. **Footer Line**: `"Report written by <Therapist name>, <Service>, <Branch>"` and print timestamp.
- **Download PDF**: Standard `window.print()` trigger with dedicated A4 print stylesheet (`@media print`) that suppresses navigation, eliminates page breaks inside photo cards and report entries, and formats clean headers and footers.

---

## 📝 How Therapists Write Progress Reports

### 1. Therapist-Authored Clinical Narrative (Zero Auto-Summarization)
The clinical progress report is **written by the therapist in words**. The system never auto-writes, auto-summarizes, or applies generative templates to clinical evaluations. Plain textareas with character counters, clear labels, and realistic example sentences under each field provide guidance while preserving the clinician's original language.

### 2. Saving Drafts
- Therapists can draft a progress update at any time while a case is active.
- Only the **Current Condition** field (non-empty) is required to save a draft.
- Drafts remain **strictly private to the owning therapist** and are completely hidden from Admins and Super Admins until submitted.

### 3. Submitting Reports
- Submitting a progress report enforces character length minimums:
  - **Current Condition**: Required, min 10 characters, max 3,000.
  - **Progress Since Last Report**: Required, min 20 characters, max 3,000.
  - **Treatment Given & Plan Ahead**: Optional, max 3,000.
  - **Remarks**: Optional, max 3,000.
- Report dates default to today IST (`Asia/Kolkata`) and are immutably locked to the date saved on the server.
- Upon submission, the report becomes visible to Admins and Super Admins in the case report view and cases table.
- An in-app notification is dispatched to clinic administrators (grouped over a 30-minute window). **Clinical narrative text is strictly excluded from notifications, email queues, and event logs.**

### 4. 24-Hour Edit Window & Immutable Version Snapshots
- The authoring therapist may edit a submitted report within **24 hours** of submission.
- Every edit creates an immutable historical snapshot in `progress_report_versions` containing the previous text, editor ID, and timestamp.
- Edited reports display an `(edited)` badge on the case tab and printable report page.
- Once 24 hours have elapsed from the submission timestamp, the report is permanently locked and cannot be edited by any user role.

### 5. Mandatory Final Report at Case Closing
- A case cannot be closed without completing the final progress report.
- The final report is saved with `report_type = 'final'`, `status = 'submitted'`, and `locked_at = NOW()` atomically in the same database transaction as the case closing.
- Once closed, no further progress updates can be submitted, and the final report cannot be edited.

---

## 🏥 Admin Panel: Rooms and Notes

The simplified Admin panel delivers streamlined operational efficiency with zero visual clutter: **no charts, no sparklines, no heatmaps, and no funnels**. The panel prioritizes high-clarity numbers, clean tables, dynamic room lifecycle management, and private administrative notes.

### 1. Room Lifecycle & Calculated Occupancy
- **Dynamic Occupancy**: Room status (`FREE`, `OCCUPIED`, `INACTIVE`) is never stored as a mutable boolean flag. It is computed dynamically via a join on active cases (`cases.room_id = rooms.id AND cases.status <> 'completed'`), preventing desynchronization.
- **Engine-Level Race Prevention**: Concurrency conflicts are strictly blocked at the PostgreSQL engine level via a partial unique index:
  ```sql
  CREATE UNIQUE INDEX one_open_case_per_room ON cases (room_id)
  WHERE status <> 'completed' AND room_id IS NOT NULL;
  ```
  If two practitioners attempt to reserve the same room simultaneously, exactly one succeeds and the other receives a friendly message: *"This room was just taken by another patient. Please choose another room."*
- **Room Immutability**: The assigned room is locked once a case is opened. Case reassignment keeps the room assigned. Closing or completing a case frees the room immediately for other patients.
- **Protection & Deletion Rules**:
  - Occupied rooms cannot be renamed or deactivated.
  - Rooms that have **ever** been linked to any case (past or present) cannot be deleted; administrators are guided to deactivate them instead.
  - Only rooms that have never been used can be deleted.
- **Bulk Room Creation**: Administrators can generate ranges of rooms per branch (e.g., prefix `R-`, start `101`, end `110`) in a single atomic action that automatically skips duplicates and reports a creation summary.

### 2. Admin Dashboard & Metrics
- **Plain Numbers Only**: 4 clean metric boxes: Active Practitioners, Active Cases, Sessions on Selected Date, and Rooms in Use / Total.
- **Clean Practitioners Table**: Displays Practitioner Name, Sessions on this date, Active cases, Cases closed on this date, Rooms in use, and Last login.
  - Sortable headers and instant search.
  - Sticky totals row summing all column values.
  - Quick-action **Send note** button and dropdown menu.
- **Historical Date Navigation**: Selecting past dates renders an informational banner (*"Viewing historical data as of [Date]"*), showing exact historical state without modification capabilities.

### 3. Admin Notes to Practitioners
- **Direct Communication**: Clinic administrators can send direct operational notes (up to 1,000 characters) to therapists.
- **Privacy First**: Note text is strictly plain text and is **never** included in Resend notification emails. Notification emails contain only: *"You have a new note from <Admin Name> on Guild Club Services"* with a direct sign-in button.
- **In-App Delivery**: Creates an in-app notification with an 80-character preview, updates the therapist's navigation badge, and displays on `/therapist/notes` with a one-click *"Mark as read"* action.
- **Read Receipts**: When a therapist marks a note as read, the administrator sees a green `Seen` badge on the practitioner's detail page (`/admin/therapists/[id]`).
- **Safety Limits**: Rate limited to 20 notes per hour per administrator. Blocked if attempting to send to deactivated practitioners.

### 4. High-Clarity Credentials Dispatch
- **Crystal Clear Credentials**: When an administrator registers a therapist (`/admin/therapists/new`) or resends credentials, the therapist receives an onboarding email featuring a prominent **Account Login Credentials** card.
- **Email & Password Included**: Contains Login ID / Email, Access Password (in monospace font with dedicated container), Assigned Role, Created By, and direct Sign In button.
- **Zero Inbox Noise**: Case assignment emails (`case_assigned`) to therapists have been removed since clinicians create and self-assign cases directly.

---

## ✅ Role-by-Role Test & Verification Checklist

### 👑 Super Admin Checklist
- [ ] **Sign In**: Login with Super Admin credentials. Verify redirection to `/super-admin/dashboard`.
- [ ] **Date Selector Navigation**:
  - [ ] Switch to **Yesterday**: Verify URL updates to `?date=YYYY-MM-DD` and the yellow read-only banner appears.
  - [ ] Switch to **Last 7 days**: Verify URL updates to `?from=...&to=...` and aggregated data renders.
  - [ ] Pick an empty date: Verify "No activity on this date" placeholder appears.
- [ ] **Drill-Down Drawer**:
  - [ ] Click any KPI card (e.g. "Cases Created"): Drawer opens listing individual actions with timestamps and client details.
  - [ ] Click a Therapist card: Drawer filters actions to that practitioner.
  - [ ] Click a Case Movement row: Drawer filters actions to that specific case.
- [ ] **Admin Management (`/super-admin/admins`)**:
  - [ ] Create a new Admin with temporary password. Verify `admin_credentials` enqueued.
  - [ ] Toggle active status. Verify deactivated admin cannot log in.
- [ ] **Analytics & Reports (`/super-admin/reports`)**:
  - [ ] Verify Overall Success Rate, Average Resolution Time, and Acceptance Time cards.
  - [ ] Change date range filter and verify charts re-render.
  - [ ] Click **Export Excel**: Confirm `.xlsx` file downloads with 4 sheets.
  - [ ] Click **Export PDF**: Confirm `.pdf` summary document downloads.

### 🛡️ Admin Checklist
- [ ] **Sign In**: Login with Admin credentials. Verify redirection to `/admin/dashboard`.
- [ ] **Intake Operations (`/admin/cases/new`)**:
  - [ ] Create a new client and case. Verify sequential case number `GCS-YYYY-NNNN` generated.
  - [ ] Assign an active therapist with available capacity.
- [ ] **Caseload Capacity Monitoring (`/admin/therapists`)**:
  - [ ] Register a new therapist with 5 max open cases.
  - [ ] Verify capacity badge updates dynamically as cases are assigned.
- [ ] **Date-Wise Dashboard**:
  - [ ] Confirm "Cases Created Today" and "Assigned Today" reflect intake activities.
  - [ ] Check "Unassigned Cases as of Date" list.
- [ ] **Security Check**:
  - [ ] Attempt navigating to `/super-admin/reports`. Verify immediate redirection to `/admin/dashboard`.

### 🩺 Therapist Checklist
- [ ] **Sign In**: Login with Therapist credentials. Verify redirection to `/therapist/dashboard`.
- [ ] **Caseload Privacy**:
  - [ ] Confirm only cases assigned to this therapist are listed.
  - [ ] Verify API `/api/dashboard/people` and `/movements` return 403 Forbidden.
- [ ] **Accept / Decline Workflow**:
  - [ ] Accept a pending case invitation. Verify status updates to `accepted`.
  - [ ] Decline a case invitation with a rationale. Verify case returns to unassigned and admin is notified.
- [ ] **Clinical Actions (`/therapist/cases/[id]`)**:
  - [ ] Add confidential clinical notes.
  - [ ] Schedule and mark a therapy session as "held".
  - [ ] Close case with clinical outcome (`successful`, `unsuccessful`, `referred`).
- [ ] **Date-Wise Historical Review**:
  - [ ] Select past dates to verify previous session notes and held appointments without ability to modify closed records.

