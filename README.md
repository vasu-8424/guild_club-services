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
  - `therapist_credentials`: Welcome email with credentials and first-login requirements
  - `case_assigned`: New case notification with priority and client name
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

