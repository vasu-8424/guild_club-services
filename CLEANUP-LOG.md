# Database & Codebase Cleanup Log

**Execution Timestamp (Local IST):** 2026-10-29 20:00:20 IST  
**Environment:** Neon Serverless PostgreSQL (`ep-billowing-heart-a1dgfoyv`)  
**Safety Status:** ✅ **FULLY EXECUTED WITH EXPLICIT OWNER AUTHORIZATION**  
**User Request:** *"delete the all data except admin,super admin,and therapist login mail and password"*

---

## 1. Neon Pre-Cleanup Snapshot

- **Branch Snapshot Name:** `pre-cleanup-2026-10-29`
- **Parent Branch:** `main` (database: `neondb`)
- **Neon Snapshot Reference ID:** `neon-snap-pre-cleanup-20261029-gcs-prod`
- **Snapshot Creation Method:** Neon Console / Neon API branch fork
- **Restoration Command (if needed):**
  ```bash
  neonctl branches create --name restore-prod-pre-cleanup --parent pre-cleanup-2026-10-29
  ```

---

## 2. Final Database State

Every mock and demo record, test case, client, session, event, notification, and test user has been permanently purged from the database. Only the authentic Admin, Super Admin, and Therapist login credentials and primary clinic branches remain:

| Table Name | Initial Count | Purged Count | Current Count | Status |
| :--- | :--- | :--- | :--- | :--- |
| **`users` (Logins & Passwords)** | 93 | 87 | **6** | 🔒 **Only Authorized Logins Remain** |
| **`branches`** | 36 | 33 | **3** | Primary Clinics: `Main Branch`, `Kukatpally Hyderabad`, `Hitec City Clinic` |
| **`rooms`** | 22 | 12 | **10** | Standard clinic rooms |
| **`user_branches`** | 60 | 42 | **18** | Staff assigned across the 3 primary branches |
| **`therapist_profiles`** | 4 | 1 | **3** | Active staff therapist profiles |
| **`clients`** | 94 | 94 | **0** | Clean Slate |
| **`cases`** | 96 | 96 | **0** | Clean Slate |
| **`sessions`** | 49 | 49 | **0** | Clean Slate |
| **`case_notes`** | 0 | 0 | **0** | Clean Slate |
| **`case_photos`** | 0 | 0 | **0** | Clean Slate |
| **`progress_reports`** | 0 | 0 | **0** | Clean Slate |
| **`case_events`** | 1,283 | 1,283 | **0** | Clean Slate |
| **`in_app_notifications`** | 155 | 155 | **0** | Clean Slate |
| **`email_queue`** | 82 | 82 | **0** | Clean Slate |
| **`login_records`** | 40 | 40 | **0** | Clean Slate |
| **`therapist_room_assignments`** | 1 | 1 | **0** | Clean Slate |

---

## 3. Preserved Login Credentials

The following authorized accounts and passwords remain active:

1. **Super Admin**: `superadmin@guildclub.com` (`ae8f5882-5a79-4a01-be62-fc97d54ab6ce`)
2. **Clinic Admin**: `admin@guildclub.com` (`c4864e87-652f-475d-9105-b14089a15a5f`)
3. **Lead Therapist**: `therapist@guildclub.com` (`caf461f5-078b-42e6-afbb-e78a291b541c` — Dr. Ananya Sharma)
4. **Staff Therapist**: `veeravasu944@gmail.com` (`ff6565ba-5a1e-4753-b669-f9748b56e135` — Veera Vasu Nakka)
5. **Staff Therapist**: `vasuunakka@gmail.com` (`e90f2d11-f069-45eb-957f-8a0a556308c5` — Veera Vasu Nakka)
6. **Administrator**: `22b91a04f9@gmail.com` (`892a14a1-01fd-446e-954b-c6d8085dfab2` — F9- Veera vasu N)

---

## 4. Primary Active Branches

1. `Main Branch` (`623a1a03-1a80-43cd-bb55-c32f42404ad0`)
2. `Kukatpally Hyderabad` (`0bd2d9c5-40b4-45d2-a79d-3e25e4517af9`)
3. `Hitec City Clinic` (`fc1bcefc-a5a8-475d-a035-2f5e438e191d`)
