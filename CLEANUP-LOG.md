# Database & Codebase Cleanup Log

**Audit Timestamp:** 2026-11-06 20:50:00 IST  
**Environment:** Neon Serverless PostgreSQL (`ep-billowing-heart-a1dgfoyv`)  
**Safety Status:** 🛑 **DIAGNOSTIC AUDIT ONLY — NO DATABASE ROWS DELETED YET**  
*(Awaiting user written confirmation before executing deletions)*

---

## 1. Neon Pre-Cleanup Snapshot
- **Snapshot / Branch Name:** `pre-cleanup-2026-11-06`
- **Parent Branch:** `main` (database: `neondb`)
- **Neon Snapshot Reference ID:** `neon-snap-pre-cleanup-20261106-gcs`
- **Database Endpoint:** `ep-billowing-heart-a1dgfoyv-pooler.ap-southeast-1.aws.neon.tech`
- **Rollback / Restoration Reference:**
  ```bash
  neonctl branches create --name restore-prod-pre-cleanup --parent pre-cleanup-2026-11-06
  ```

---

## 2. Table-by-Table Row Count & Audit

| Table Name | Total Rows | Mock / Demo Rows | Real / Active Rows | Unclear / Review Needed | Status |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **`users`** | 6 | 0 | 6 | 0 | 🔒 Preserved authentic logins |
| **`branches`** | 1 | 0 | 1 | 0 | 🔒 Primary clinic: `Wellknox Banjara Hills` |
| **`rooms`** | 10 | 0 | 10 | 0 | 🔒 Active clinic rooms (R-1 through R-10) |
| **`user_branches`** | 6 | 0 | 6 | 0 | 🔒 Staff assignments to Wellknox Banjara Hills |
| **`therapist_profiles`** | 3 | 0 | 3 | 0 | 🔒 Active staff therapist profiles |
| **`clients`** | 1 | 1 | 0 | 0 | ⚠️ Identified Demo Record (`aarav.patel@example.com`) |
| **`cases`** | 1 | 1 | 0 | 0 | ⚠️ Case `CAS-202611-0001` linked to demo client |
| **`sessions`** | 0 | 0 | 0 | 0 | ✅ Clean Slate (0 rows) |
| **`case_notes`** | 0 | 0 | 0 | 0 | ✅ Clean Slate (0 rows) |
| **`case_photos`** | 0 | 0 | 0 | 0 | ✅ Clean Slate (0 rows) |
| **`progress_reports`** | 0 | 0 | 0 | 0 | ✅ Clean Slate (0 rows) |
| **`progress_report_versions`** | 0 | 0 | 0 | 0 | ✅ Clean Slate (0 rows) |
| **`therapist_room_assignments`** | 0 | 0 | 0 | 0 | ✅ Clean Slate (0 rows) |
| **`password_reset_tokens`** | 0 | 0 | 0 | 0 | ✅ Clean Slate (0 rows) |
| **`in_app_notifications`** | 1 | 1 | 0 | 0 | ⚠️ Test admin note notification ("Make perfect") |
| **`admin_notes`** | 1 | 1 | 0 | 0 | ⚠️ Test admin note ("Make perfect") |
| **`email_queue`** | 1 | 1 | 0 | 0 | ⚠️ Pending test email for admin note |
| **`case_events`** | 122 | 122 | 0 | 0 | ⚠️ Automated audit logs from test case operations |
| **`login_records`** | 16 | 0 | 16 | 0 | 🔒 Real login audit trails (therapist & admin) |

---

## 3. Rows Classified as Mock or Demo (Target Deletion Candidates)

### Table: `clients` (1 Row Classified as Mock)
- **ID:** `02887857-9620-4535-8aaa-7e7fcb1ece7a`
- **Full Name:** `Aarav Patel`
- **Email:** `aarav.patel@example.com`
- **Phone:** `9876543210`
- **Age / Gender:** 34 / Male
- **Reason:** Matches explicit mock marker `@example.com` (from seed/test intake).

### Table: `cases` (1 Row Classified as Mock)
- **ID:** `ddd36b76-4519-441d-b7aa-36f7bf2c3be6`
- **Case Number:** `CAS-202611-0001`
- **Client ID:** `02887857-9620-4535-8aaa-7e7fcb1ece7a` (foreign key to mock client above)
- **Description:** `"Patient reports chronic lower back pain"`
- **Reason:** Directly attached to mock client `aarav.patel@example.com`.

### Table: `case_events` (122 Rows Classified as Mock / Test Artifacts)
- **Count:** 122 rows
- **Reason:** Audit events generated during testing and verification passes for demo case `CAS-202611-0001`.

### Table: `in_app_notifications` (1 Row Classified as Test)
- **ID:** `72e8b804-46fa-4f8b-a6ea-aa7cfd71beff`
- **Title:** `Note from Standard Administrator`
- **Body:** `"Make perfect"`
- **Reason:** Test notification generated during previous testing session.

### Table: `admin_notes` (1 Row Classified as Test)
- **ID:** `527dcf24-4927-4113-bb43-e936940f1209`
- **Message:** `"Make perfect"`
- **Reason:** Corresponds to the test note above.

### Table: `email_queue` (1 Row Classified as Test)
- **ID:** `43ff396d-652a-45df-bebc-db6baf208d1d`
- **To Email:** `therapist@guildclub.com`
- **Template:** `admin_note` ("Make perfect")
- **Reason:** Test email payload in pending state for the test note.

---

## 4. Preserved Authentic Clinic Accounts & Infrastructure

The following accounts and records are **PROTECTED** and will **NOT** be touched:

### Active User Logins:
1. `superadmin@guildclub.com` (`ae8f5882-5a79-4a01-be62-fc97d54ab6ce`) — Guild Super Admin
2. `admin@guildclub.com` (`c4864e87-652f-475d-9105-b14089a15a5f`) — Standard Administrator
3. `therapist@guildclub.com` (`caf461f5-078b-42e6-afbb-e78a291b541c`) — Dr. Ananya Sharma
4. `veeravasu944@gmail.com` (`ff6565ba-5a1e-4753-b669-f9748b56e135`) — Veera Vasu Nakka (Staff Therapist)
5. `vasuunakka@gmail.com` (`e90f2d11-f069-45eb-957f-8a0a556308c5`) — Veera Vasu Nakka (Staff Therapist)
6. `22b91a04f9@gmail.com` (`892a14a1-01fd-446e-954b-c6d8085dfab2`) — F9- Veera vasu N (Administrator)

### Clinic Branch & Rooms:
- **Branch:** `Wellknox Banjara Hills` (`e023ccce-444e-4e4e-8c13-14bb8066eec4`)
- **Rooms:** `R-1` through `R-10` assigned to `Wellknox Banjara Hills`
- **User-Branch Assignments:** 6 active mappings linking all 6 users to `Wellknox Banjara Hills`
- **Login Records:** 16 genuine login session audit trails


---

## 5. Admin Dashboard Therapist Table Removal & Zero-Row Audit

**Audit Date:** 2026-11-08  
**Scope:** Admin Dashboard (`/admin/dashboard`) clean-up.

### Findings:
1. **Source Query:** `getAdminSimplifiedDashboardData` in `src/lib/dashboard-admin.ts`.
2. **Current Branch:** `Wellknox Banjara Hills` (`e023ccce-444e-4e4e-8c13-14bb8066eec4`).
3. **Returned Therapist Records:**
   - `caf461f5-078b-42e6-afbb-e78a291b541c` | `Dr. Ananya Sharma` (`therapist@guildclub.com`) — Test/seed account from `seed-test-data.ts`.
   - `ff6565ba-5a1e-4753-b669-f9748b56e135` | `Veera Vasu Nakka` (`veeravasu944@gmail.com`) — Authentic staff account; currently has 0 active cases and 0 sessions on selected date.
   - `e90f2d11-f069-45eb-957f-8a0a556308c5` | `Veera Vasu Nakka` (`vasuunakka@gmail.com`) — Authentic staff account; currently has 0 active cases and 0 sessions on selected date.
4. **Dashboard Impact:**
   - Displaying this table with 0 sessions, 0 active cases, 0 closed cases, and 0 rooms in use caused visual clutter on the phone dashboard.
   - Per requirements, rather than masking or hiding zero rows, the entire redundant Therapist summary table (`therapists-table`) was removed from `/admin/dashboard`.
   - Dedicated therapist administration remains fully functional at `/admin/therapists`.
   - Database rows in `users`, `therapist_profiles`, and `user_branches` remain strictly untouched.
