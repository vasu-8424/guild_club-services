# Testing Guide — Guild Club Services

This guide documents the automated testing architecture, environment configuration, test suites, and commands for **Guild Club Services** (Next.js App Router, TypeScript, Neon Serverless PostgreSQL with Drizzle ORM).

---

## 1. Quick Start

Run test suites using the pre-configured npm scripts:

```bash
# Run all Stage 2 functional operation tests (59 tests)
npm run test:stage2

# Run all end-to-end tests across the entire project (104 tests)
npm run test:all

# Run tests with Playwright interactive UI
npm run test:e2e:ui

# View the latest HTML test report
npm run test:report
```

---

## 2. Test Architecture & Environment Safety

### Neon Test Branch Isolation
- All tests **must run exclusively against a dedicated test database branch** (e.g., `neondb_test`).
- The test environment configuration is stored in `.env.test`.
- Every test file and helper enforces database safety via `assertTestDatabase()`:
  ```typescript
  import { assertTestDatabase } from "../helpers/stage2-helpers";
  
  // Aborts test execution immediately if DATABASE_URL does not point to the test database
  const dbUrl = assertTestDatabase();
  ```
- **Never point `.env.test` to production databases.** The test runner will automatically throw an error if the database URL does not match test branch naming conventions.

### Database Reset & Seeding (`tests/auth.setup.ts`)
Before each test run, Playwright executes `tests/auth.setup.ts` as a dependency:
1. Clears existing transactional test data (`case_events`, `case_notes`, `sessions`, `cases`, `clients`, `email_queue`).
2. Seeds primary role accounts:
   - Super Admin: `test.superadmin@guildclub.com`
   - Admin: `test.admin@guildclub.com`
   - Therapist: `test.therapist@guildclub.com`
   - Forced-Password-Change user: `test.newadmin@guildclub.com`
   - Deactivated user: `test.deactivated@guildclub.com`
3. Captures and saves browser storage states for rapid authenticated sessions (`playwright/.auth/`).

---

## 3. Test Suites Directory Structure

```
tests/
├── auth.setup.ts                     # Pre-test DB reset, account seeding, auth state persistence
├── helpers/
│   ├── auth-helpers.ts               # Stage 1 authentication and cookie helpers
│   └── stage2-helpers.ts             # Stage 2 DB, email queue, UI automation helpers
└── e2e/
    ├── # STAGE 1 SUITES (45 tests)
    ├── hlth.spec.ts                  # HLTH-01..03: Project health, build, error logging
    ├── auth.spec.ts                  # AUTH-01..10: Multi-role authentication & rate limiting
    ├── pwd.spec.ts                   # PWD-01..05: Forced initial password change
    ├── rbac.spec.ts                  # RBAC-01..07: Role-based route protection
    ├── ui.spec.ts                    # UI-01..05: Layout, accessibility (axe-core), responsiveness
    ├── db.spec.ts                    # DB-01..10: Database schema constraints & audit log integrity
    ├── sec.spec.ts                   # SEC-01..04: Security headers, cookie flags, API auth
    │
    └── # STAGE 2 SUITES (59 tests)
        ├── stage2-admin.spec.ts      # ADM-01..09: Super Admin admin management & temp credentials
        ├── stage2-therapist.spec.ts  # THR-01..09: Admin therapist registration & caseload capacity
        ├── stage2-case.spec.ts       # CASE-01..07: Clinical case intake & sequential numbering
        ├── stage2-assignment.spec.ts # ASG-01..08: Case assignment, therapist dropdown, email alert
        ├── stage2-email-pwd.spec.ts  # EML-01..02, PWR-01..04: Email queue processor & reset flow
        ├── stage2-integrity.spec.ts  # INT-01..05: Role integrity, caselist privacy, deactivation
        ├── stage2-workflow.spec.ts   # THW-01..13: Therapist invitations, notes, sessions, discharge
        ├── stage2-journey.spec.ts    # E2E-01: 13-step unbroken lifecycle journey from intake to discharge
        │
        └── # STAGE 3 SUITES (12 tests)
            └── stage3-dashboard.spec.ts  # DSH-01..11: Date selector, Asia/Kolkata boundary, drilldown drawer, analytics & exports
```

---

## 4. Test Specifications Summary

### Stage 2: Clinical Operations
| Suite Name | Spec IDs | Key Assertions |
|---|---|---|
| **Admin Management** | ADM-01 – ADM-09 | Form submission, password hashing, `admin_credentials` in `email_queue`, `admin_created` in `case_events`, deactivation |
| **Therapist Management** | THR-01 – THR-09 | Registration, capacity limits, specialization, login with temporary credentials, deactivation |
| **Case Management** | CASE-01 – CASE-07 | Client demographics, presenting issues, `GCS-YYYY-NNNN` sequential numbering, `case_created` event |
| **Case Assignment** | ASG-01 – ASG-08 | Therapist dropdown filtering, assignment action, `case_assigned` event, therapist notification email |
| **Email & Password Reset** | EML-01–02, PWR-01–04 | `/api/email/process` batch worker, password reset token generation, token expiry, credential update |
| **Role & Data Integrity** | INT-01 – INT-05 | Cross-role route protections (403), unauthorized case viewing prevention, deactivated therapist filtering |
| **Therapist Workflow** | THW-01 – THW-13 | Accept/decline invitations, clinical notes, scheduling/holding/missing sessions, status transitions, discharge |
| **Lifecycle Journey** | E2E-01 | Single unbroken test executing all 13 stages from Super Admin creation to clinical discharge |

### Stage 3: Date-Wise Dashboards, Analytics & Reports
| Suite Name | Spec IDs | Key Assertions |
|---|---|---|
| **Date Selector Topbar** | DSH-01 | Visible on Super Admin, Admin, and Therapist dashboards; defaults to Today IST |
| **URL Date Persistence** | DSH-02 | Selecting Yesterday updates `?date=YYYY-MM-DD` and triggers dashboard re-render |
| **Historical Read-Only** | DSH-03 | Selecting past date displays amber "Viewing history (read-only)" banner |
| **Empty Day Handling** | DSH-04 | Dates with zero events display "No activity on this date" placeholder |
| **Midnight IST Boundaries** | DSH-05 | Seeded 23:58:00 IST and 00:03:00 IST events correctly partitioned into adjacent days |
| **KPI Card Drill-Down** | DSH-06 | Clicking KPI card slides out drawer with timestamped individual actions |
| **Case Movements** | DSH-07 | Status transitions displayed with from/to badges and clickable case drilldowns |
| **Role Scoping (403)** | DSH-08 | Therapist accessing `/api/dashboard/people` or `/movements` receives 403 Forbidden |
| **Therapist Isolation** | DSH-09 | `/api/dashboard/drilldown` ignores injected actorId and forces therapist's own ID |
| **Super Admin Reports** | DSH-10 | Renders success rate, turnaround time, workload charts, and Excel/PDF download buttons |
| **Route Security** | DSH-11 | Admin attempting to access `/super-admin/reports` is redirected to `/admin/dashboard` |

---

## 5. Playwright Configuration (`playwright.config.ts`)

- **Base URL:** `http://localhost:3000`
- **Web Server:** Automatically launches `npm run dev` with environment variables from `.env.test`.
- **Workers:** 1 worker (to preserve database transactional consistency during serial workflow testing).
- **Retries:** 1 retry on CI/local runs.
- **Artifacts:**
  - Screenshots: Captured automatically on failure.
  - Video: Retained on failure.
  - Trace: Captured on first retry for debugging.

---

## 6. Best Practices for Writing & Maintaining Tests

1. **Auto-Waiting Over Sleeps:** Never use `page.waitForTimeout()` or artificial sleeps. Use Playwright's built-in assertions (`toBeVisible()`, `toHaveURL()`, `toHaveCount()`) which automatically poll until elements reach the expected state.
2. **Dedicated Test IDs:** Always use `data-testid` attributes instead of CSS classes or brittle text selectors.
3. **Scope Iterated Elements:** In lists and tables, use container-scoped test IDs (e.g., `[data-testid="invitation-row-${caseNumber}"]`) to prevent accidental ancestor element matches.
4. **Direct DB Assertions:** Functional tests should test the UI like a real user, but verify business invariants (events recorded, emails queued, password hashes updated) by querying the test database directly via `@neondatabase/serverless`.
