# Therapist Session Board & Clinical Verification System

This document outlines the architecture, data models, clinical verification workflow, security controls, and audit event tracking implemented for the **Session Board** at `/therapist/dashboard`.

---

## 1. How It Works

### A. Therapist Landing Screen (`/therapist/dashboard`)
Upon login, therapists land on a focused **Session Board** designed for fast, high-volume clinic operations:
- **Header Row**:
  - Displays **"Assigned Room: <Room No.>"** (or `"Room: Not assigned"` if no assignment exists for the date).
  - Date picker defaulting to **Today**, formatted as `23 Oct 2026`.
  - Date rules: A history notice (`"Viewing history for <date> · Read-only"`) appears when inspecting past dates. Past pending sessions are marked `"Not completed"`.
- **Legend & Progress Bar**:
  - Real-time counters: `Pending: X · Completed: Y`.
  - Interactive thin progress bar showing completed session ratio.
- **Session Grid**:
  - **Responsive Layout**: 5 blocks per row on desktop (≥1024px/1440px), 3 blocks per row on tablet (768px), and 2 blocks per row on mobile (390px).
  - **Cards**: Large, tappable cards (min 96px on desktop, 120px on mobile) showing scheduled time, truncated patient name, room, and status badge.
  - **Color & Accessibility Rule**:
    - **Pending** (not completed): Calm red tint (`border-red-200 bg-red-50/70 text-red-900`) with a Clock icon and explicit text label `"Pending"`.
    - **In Progress**: Red block with a small amber/blue `"In progress"` tag when checked in.
    - **Completed**: Calm emerald green tint (`border-emerald-200 bg-emerald-50/70 text-emerald-900`) with a Check icon and explicit text label `"Completed"`.
    - `data-status="pending|completed"` on every card for testing and accessibility hooks.
- **Empty State**: Friendly `"No sessions scheduled for this date"` illustration when the therapist has no appointments on the selected date.
- **Sidebar & Cases Navigation**:
  - The previous cases table was cleanly migrated to its own dedicated sidebar navigation item: **"My Cases"** (`/therapist/cases`).

---

### B. Session Detail Clinical Drawer
Clicking any session block opens a dedicated drawer (right-side drawer on desktop/tablet, full-screen sheet on mobile):

1. **Patient & Appointment Header**:
   - Patient Name, Age (calculated automatically from client date of birth), Case number, Scheduled Time, and Room.
2. **Photo Consent**:
   - Optional toggle: `"Patient has consented to photos"` (default ON, configurable via `DEFAULT_PHOTO_CONSENT`).
3. **In-Time Verification Photo**:
   - Button `"Take / upload photo"` with `<input type="file" accept="image/*" capture="environment">` enabling direct rear-camera activation on smartphones with fallback to file gallery.
   - Client compresses images to max 1600px prior to upload.
   - **Server-stamped timestamp**: The server generates the `inTimeAt` timestamp upon receipt; client clock is never trusted.
4. **"What You Have Done" (Clinical Notes)**:
   - Textarea requiring at least 10 characters detailing interventions and therapy performed.
   - Includes a **"Save draft"** button allowing incremental note-taking during the session.
5. **Out-Time Verification Photo**:
   - Disabled until in-time photo is confirmed on the server.
   - Server validates and stamps `outTimeAt`, enforcing `outTimeAt >= inTimeAt`.
6. **Patient Signature Pad**:
   - Responsive HTML5 `<canvas>` supporting finger, stylus, and mouse interactions.
   - High-DPI screen scaling, Undo/Redo state stack, and Clear button.
   - Saved as a compressed PNG.
7. **"Complete Session" Button**:
   - Enforces a strict 4-point clinical verification gate. Enabled **ONLY** when:
     1. In-time photo is uploaded and stamped.
     2. "What you have done" notes are provided (>= 10 chars).
     3. Out-time photo is uploaded and stamped.
     4. Patient signature is captured.
   - Disables automatically while saving to prevent duplicate submissions.
   - On completion: Session status transitions to `held`, the block instantly turns **GREEN**, a toast is shown, and the drawer closes. Board counters and progress update without page reload.
   - Completed sessions become **read-only**; therapists cannot modify completed records.

---

## 2. Database Changes & Schema

### A. Extended `sessions` Table
The `sessions` table was extended with 8 new fields in migration `0004_happy_cannonball.sql`:

| Column | Type | Description |
|---|---|---|
| `in_time_at` | `timestamp with time zone` | Server-stamped check-in time |
| `in_time_photo_key` | `varchar(500)` | Secure storage key for in-time photo |
| `out_time_at` | `timestamp with time zone` | Server-stamped check-out time |
| `out_time_photo_key` | `varchar(500)` | Secure storage key for out-time photo |
| `work_done` | `text` | Notes detailing therapy interventions (min 10 chars) |
| `patient_signature_key`| `varchar(500)` | Secure storage key for patient signature PNG |
| `photo_consent` | `boolean` | Photo consent confirmation (default: `true`) |
| `completed_at` | `timestamp with time zone` | Server-stamped timestamp when session was marked `held` |

### B. New `therapist_room_assignments` Table
Manages daily room allocations for clinic practitioners:

```sql
CREATE TABLE "therapist_room_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "therapist_id" uuid NOT NULL REFERENCES "therapist_profiles"("id") ON DELETE CASCADE,
  "assigned_date" date NOT NULL,
  "room_no" varchar(50) NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "therapist_room_date_unique" UNIQUE ("therapist_id", "assigned_date")
);
```

---

## 3. Audit Events Written

All state changes run inside database transactions and write immutable audit records to the `audit_events` log:

| Event Type | Actor Role | Trigger / Conditions |
|---|---|---|
| `session_check_in` | `therapist` | When therapist captures and uploads in-time photo |
| `session_check_out` | `therapist` | When therapist uploads out-time photo after check-in |
| `session_signed` | `therapist` | When patient signature PNG is captured and saved |
| `session_held` | `therapist` | When all 4 requirements are verified and session is completed |
| `room_assigned` | `admin` / `super_admin` | When administrator assigns/reallocates a room to a therapist |

*Existing date-wise dashboards count `session_held` to track operational velocity without interruption.*

---

## 4. Sensitive File Storage & Private Route Security

Photos and signatures contain sensitive patient healthcare data (PHI). Raw storage URLs are never exposed.

- **Storage Engine**: `src/lib/storage.ts`
  - Uses `@vercel/blob` when `BLOB_READ_WRITE_TOKEN` is configured.
  - Transparently falls back to local authenticated file storage (`storage/files/`) in local/test environments.
- **Private Stream Route**: `/api/files/[sessionId]/[type]`
  - Validates session authentication via cookie JWT (`requireRole()`).
  - **Ownership Check**:
    - Therapist **must own** the session (`session.therapistId === user.id`).
    - Admins and Super Admins have read-only access for case audits.
    - All other users receive `403 Forbidden`.
    - Unauthenticated requests receive `401 Unauthorized`.
- **Validation Rules**:
  - Photos: JPEG, PNG, or WebP only; maximum size 5 MB.
  - Signatures: PNG only; maximum size 500 KB.
  - Client-side compression to max 1600px.

---

## 5. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | Optional | Vercel Blob access token for cloud file storage. If omitted, files fall back securely to local storage directory `storage/files/`. |
| `DEFAULT_PHOTO_CONSENT` | Optional | Defaults to `true`. Governs default state of photo consent checkbox. |

---

## 6. Admin & Super Admin Features

1. **Room Assignment**:
   - On `/admin/therapists`, an **"Assign Room"** action allows selecting a practitioner, target date, and room number.
   - Automatically records the `room_assigned` audit event.
2. **Case Detail Sessions Tab**:
   - In `/admin/cases/[id]`, the **Sessions** tab renders read-only clinical session records, including timestamps, room number, in-time & out-time photos, clinical notes, and patient signature.

---

## 7. Automated Test Suite (Playwright)

Located in `tests/e2e/therapist-board.spec.ts`:
- **TSB-01**: Session grid displays 10 blocks, room assignment, legend and 5 per row on desktop (1440px).
- **TSB-02**: Session grid renders 2 per row on mobile (390px) + mobile drawer test.
- **TSB-03**: Session grid renders 3 per row on tablet (768px) + tablet drawer test.
- **TSB-04**: Clicking a block opens drawer with patient name, age, case #, and room.
- **TSB-05**: Out-time photo button is disabled until in-time photo is uploaded.
- **TSB-06**: Full clinical session workflow (in-time photo -> work done draft -> out-time photo -> canvas signature -> completion -> block turns green -> drawer re-opens read-only).
- **TSB-07**: Server rejects completion via direct API call when requirements are missing (`400 Bad Request`).
- **TSB-08**: Therapist cannot access another therapist's private session files (`403 Forbidden`).
- **TSB-09**: Private file URLs cannot be accessed when logged out (`401 Unauthorized`).
- **TSB-10**: Admin can view private session files read-only (`200 OK`).
- **TSB-11**: Past date displays history banner; pending sessions stay red and cannot be edited.
- **TSB-12**: Admin assigns room on Therapists page and therapist dashboard reflects the assigned room.
- **TSB-13**: Audit events `session_check_in`, `session_check_out`, `session_signed`, and `session_held` exist with therapist actor.

- **TSB-14**: Seed demo sessions populates 10 sessions (3 green completed, 7 red pending) and Room 204.
- **TSB-15**: Timezone boundary test (sessions at 00:05 IST and 23:55 IST show on the correct day).
- **TSB-16**: Isolation check ensuring another therapist's sessions do not appear on this therapist's board.
- **TSB-17**: Empty state verification when therapist has open cases but no sessions on selected date.

---

## 8. Demo Seed Script (`npm run seed:demo`)

To populate a therapist's session board with realistic demonstration data for development or testing:

```bash
npm run seed:demo [therapist-email]
```

- **Safety**: Automatically refuses to run if `NODE_ENV === "production"`.
- **Default Target**: `veeravasu944@gmail.com` (or first available therapist).
- **Artifacts Created**:
  1. Room assignment for Today: `Room 204` in `therapist_room_assignments`.
  2. 1 Client (`Aarav Sharma`) + 1 Case in `accepted` status (`GCS-2026-DEMO1`).
  3. 10 Sessions today at 30-minute intervals starting from 09:00 IST:
     - **3 Completed Sessions** (09:00, 09:30, 10:00) with in-time/out-time timestamps, work notes, signature, and green badge.
     - **7 Pending Sessions** (10:30 through 13:30) with red badge and clock icon.
- **Idempotency**: Fully idempotent and safe to execute repeatedly without duplicating data.

---

### Responsive Screenshots Saved:
- `/test-results/screenshots-ui/therapist-board-desktop-1440.png`
- `/test-results/screenshots-ui/therapist-board-tablet-768.png`
- `/test-results/screenshots-ui/therapist-board-mobile-390.png`
- `/test-results/screenshots-ui/therapist-drawer-open-1440.png`
- `/test-results/screenshots-ui/therapist-drawer-open-768.png`
- `/test-results/screenshots-ui/therapist-drawer-open-390.png`
