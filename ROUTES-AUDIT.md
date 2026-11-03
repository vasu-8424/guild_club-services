# Mobile Route Inventory & Layout Audit
**Application**: Guild Club Services (Clinical Case Management Portal)  
**Framework**: Next.js 16 App Router + TypeScript + Tailwind CSS v4 + Capacitor 8 Android  
**Target Viewports**: 360×740 (Compact Android), 390×844 (Standard iPhone), 430×932 (Large iPhone Pro Max)  
**Layout Paradigm**: Single phone-first column (360–430px native, max 480px centered on desktop)

---

## 1. Complete Route Inventory (32 Routes)

| # | Role | Route Path | Shell / Layout File | Page Type | 360px | 390px | 430px | Notes / Status |
|---|------|------------|---------------------|-----------|:-----:|:-----:|:-----:|----------------|
| 1 | Public | `/` | Root (`src/app/layout.tsx`) | Redirect | PASS | PASS | PASS | Smooth redirect to `/login` or designated role dashboard |
| 2 | Public | `/login` | Root (`src/app/layout.tsx`) | Form | PASS | PASS | PASS | Official emblem, 16px inputs, REST-based login with instant feedback |
| 3 | Public | `/forgot-password` | Root (`src/app/layout.tsx`) | Form | PASS | PASS | PASS | Official emblem, sharp corners, stacked 48px action button |
| 4 | Public | `/reset-password` | Root (`src/app/layout.tsx`) | Form | PASS | PASS | PASS | Official emblem, validation cards, mobile touch targets |
| 5 | Public | `/change-password` | Root (`src/app/layout.tsx`) | Form | PASS | PASS | PASS | Official emblem header, password policy checklist |
| 6 | Public | `/offline` | Root (`src/app/layout.tsx`) | Status | PASS | PASS | PASS | Standalone offline status indicator with retry button |
| 7 | Shared | `/notifications` | `DashboardShell` | List | PASS | PASS | PASS | Date-grouped notification list, unread indicators, touch items |
| 8 | Shared | `/cases/[id]/report` | `DashboardShell` | Report | PASS | PASS | PASS | Clinical case progression report, stacked metrics, export actions |
| 9 | Super Admin | `/super-admin/dashboard` | `DashboardShell` | Dashboard | PASS | PASS | PASS | 2-col metric tiles, system-wide counts, recent activity |
| 10 | Super Admin | `/super-admin/admins` | `DashboardShell` | List | PASS | PASS | PASS | Stacked admin cards, search bar, full-width create action |
| 11 | Super Admin | `/super-admin/admins/new` | `DashboardShell` | Form | PASS | PASS | PASS | Single-column form, branch multiselect, 48px submit target |
| 12 | Super Admin | `/super-admin/admins/[id]` | `DashboardShell` | Detail/Form | PASS | PASS | PASS | Admin credential detail, branch assignment drawer, audit log |
| 13 | Super Admin | `/super-admin/reports` | `DashboardShell` | Report | PASS | PASS | PASS | Date range filter, KPI stat cards, responsive charts |
| 14 | Super Admin | `/super-admin/notifications` | `DashboardShell` | List / Log | PASS | PASS | PASS | Responsive delivery cards (converted from wide desktop table) |
| 15 | Admin | `/admin/dashboard` | `DashboardShell` | Dashboard | PASS | PASS | PASS | Clinical KPI cards, quick actions, therapist activity grid |
| 16 | Admin | `/admin/branches` | `DashboardShell` | List / Manage | PASS | PASS | PASS | Branch management cards, room counts, status badges |
| 17 | Admin | `/admin/rooms` | `DashboardShell` | List / Manage | PASS | PASS | PASS | Room availability cards, single & bulk creation, assignment |
| 18 | Admin | `/admin/cases` | `DashboardShell` | List | PASS | PASS | PASS | Search, status filters, client cards with priority badges |
| 19 | Admin | `/admin/cases/new` | `DashboardShell` | Form | PASS | PASS | PASS | Stepper / single column form, camera & image picker, 52px CTA |
| 20 | Admin | `/admin/cases/[id]` | `DashboardShell` | Detail | PASS | PASS | PASS | Case timeline, patient detail card, session schedule drawer |
| 21 | Admin | `/admin/cases/[id]/report` | `DashboardShell` | Report | PASS | PASS | PASS | Printable & exportable clinical progress report |
| 22 | Admin | `/admin/therapists` | `DashboardShell` | List | PASS | PASS | PASS | Therapist cards with room badges, active cases, call/assign |
| 23 | Admin | `/admin/therapists/new` | `DashboardShell` | Form | PASS | PASS | PASS | Therapist onboarding form, specialty picker, credential setup |
| 24 | Admin | `/admin/therapists/[id]` | `DashboardShell` | Detail | PASS | PASS | PASS | Practitioner workload, assigned cases, room assignment modal |
| 25 | Admin | `/admin/therapists/[id]/edit`| `DashboardShell` | Form | PASS | PASS | PASS | Profile edit form, contact fields, active status toggle |
| 26 | Therapist | `/therapist/dashboard` | `DashboardShell` | Dashboard | PASS | PASS | PASS | Daily session agenda, attendance gate, patient queue |
| 27 | Therapist | `/therapist/cases` | `DashboardShell` | List | PASS | PASS | PASS | Patient directory, filter chips, stacked cards (refactored) |
| 28 | Therapist | `/therapist/cases/new` | `DashboardShell` | Form | PASS | PASS | PASS | Fast intake form with photo upload and camera capture |
| 29 | Therapist | `/therapist/cases/[id]` | `DashboardShell` | Detail | PASS | PASS | PASS | Clinical notes history, signature pad, treatment checklist |
| 30 | Therapist | `/therapist/cases/[id]/report` | `DashboardShell` | Report | PASS | PASS | PASS | Therapist-specific clinical summary with chart & metrics |
| 31 | Therapist | `/therapist/notes` | `DashboardShell` | List | PASS | PASS | PASS | Daily clinical notes stream, timestamped entries, quick reply |
| 32 | Therapist | `/therapist/profile` | `DashboardShell` | Detail / Form | PASS | PASS | PASS | Therapist profile, official emblem badge, security & logout |

---

## 2. Root Cause Summary & Shared Fixes Applied

1. **Horizontal Scroll Root Causes Eliminated**:
   - Replaced unconstrained `whitespace-nowrap` on buttons, badges, and table cells with `whitespace-normal break-words leading-tight`.
   - Converted all desktop-only multi-column tables (`TherapistPatientsTable`, `SuperAdminNotificationsClient`, `AdminTherapistsTable`) into responsive stacked card layouts below 640px.
   - Enforced `max-w-full min-w-0` on cards, containers, and flex children to prevent horizontal blowout.
   - Constrained wide date selectors and metric counters from 560px fixed width down to fluid 2-column or 3-column auto-wrapping grids (`month-calendar.tsx`).

2. **Header Overlap & Topbar Clutter Resolved**:
   - Replaced complex multi-select branch and date dropdowns in topbar with a compact 56px header.
   - Inner pages feature a dedicated back arrow with a 44×44px minimum touch target.
   - Main content scroll containers use `pt-0` inside the scroll view and padding-bottom `calc(4rem + env(safe-area-inset-bottom) + 1.5rem)` so content is never hidden under the bottom tab bar.

3. **Touch Targets & Form Input Usability**:
   - All interactive controls (`Button`, `ExportSplitButton`, tabs, filters, back arrows) meet or exceed the 48px standard touch target guideline.
   - Text inputs across all forms set `text-base` (16px) with explicit `inputMode` and `enterKeyHint` to prevent iOS viewport auto-zoom.
   - Primary action buttons are full-width and stacked vertically on mobile viewports.

4. **Official Branding Enforcement**:
   - Embedded the official circular emblem (`/logo.png`) across auth headers, app icons, and therapist profile.
   - Android mipmaps refreshed across hdpi, mdpi, xhdpi, xxhdpi, xxxhdpi densities.
   - Sharp corners (`rounded-none`) and brand teal `#0B7A63` applied consistently throughout.

5. **Mobile Authentication Resilience**:
   - Refactored `login/page.tsx` to handle REST API error payloads directly from `/api/auth/login`.
   - Eliminated Next.js Server Action hash mismatch errors ("An unexpected response was received from the server") on mobile and WebView clients.
