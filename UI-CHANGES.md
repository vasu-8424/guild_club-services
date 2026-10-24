# Guild Club Services — UI Redesign Specification & Changelog

## 1. Overview
The user interface of **Guild Club Services** has been completely overhauled from the ground up to deliver a clean, premium, and easy-to-understand experience across all three system roles (`Super Admin`, `Admin`, and `Therapist`). 

The redesign strictly respects the **presentation-layer-only** boundary:
- **Zero changes** to business logic, database schema, queries, or API endpoints.
- **100% preservation** of all test attributes (`data-testid`), ensuring automated Playwright suites remain completely stable.

---

## 2. Design System & Tokens

### Color Palette
- **Neutral Base**: Calm Slate palette (`slate-50` background, `slate-100` secondary, `slate-200` borders, `slate-900` text).
- **Brand Accent**: Deep Teal (`#0f766e` / `#0d9488` / `#115e59`), configured via Tailwind CSS variables and design tokens in `src/lib/tokens.ts` and `src/app/globals.css`.
- **Consistent Semantic Status Colors**:
  - **Green** (`emerald`): Completed, Discharged, Active, Success
  - **Blue** (`sky`): In Progress, Assigned, Accepted, Scheduled
  - **Amber** (`amber`): On Hold, Pending, Warning, Capacity alerts
  - **Red** (`rose`): Urgent, Declined, Danger, Deactivated, Cancelled
  - **Gray** (`slate`): New, Closed, Default

### Spacing & Layout
- **8px Grid**: Consistent multiples (`8px`, `16px`, `24px`, `32px`, `48px`).
- **Border Radii**:
  - `12px` (`rounded-xl`): Cards, tables, modals, drill-down panels.
  - `8px` (`rounded-lg`): Form inputs, buttons, and badges.
- **Shadows**: Soft, subtle elevation (`shadow-xs`, `shadow-2xs`, `hover:shadow-md`) avoiding harsh dark drop shadows.
- **Borders**: Clean `1px` subtle borders (`border-slate-200/80`).

### Typography Scale
- **Font Family**: Geist Sans (`var(--font-geist-sans)`), Inter, system-ui fallback.
- **Font Weights**: Limited to 2 weights for clean visual rhythm (`400 regular`, `600 semibold`).
- **Scale**:
  - Page Titles: `24px - 28px` semibold (`tracking-tight`)
  - Section Headings: `16px - 18px` semibold
  - Body Text: `14px` regular
  - Secondary/Meta Labels: `11px - 12px` muted text

---

## 3. UI Component Library (`src/components/ui/`)

1. **`Button`**: Primary (Deep Teal), Secondary, Outline, Ghost, Destructive; subtle `150ms` transitions, visible focus rings, and embedded loading state spinner.
2. **`Card`**: Standardized `12px` radius card container with Header, Title, Description, Content, and Footer.
3. **`StatCard` / `KpiCard`**: Max 4 metric cards at dashboard top; label, big number (`28-32px`), hint or trend line, and interactive drill-down trigger.
4. **`Badge` & `StatusBadge`**: Semantic role and case status badges with colored status indicator dots.
5. **`DataTable`**: Sticky table headers, search input, filter chips toolbar, hover state, max 6 core columns, and pagination.
6. **`Tabs`**: Clean tab navigation with Deep Teal underline active indicator and badge counters.
7. **`Dialog` & `Drawer`**: Keyboard accessible, high-contrast modal backdrop, smooth slide-in for timestamped drill-downs.
8. **`EmptyState`**: Friendly dashed border placeholder with icon, clear explanatory text, and primary call-to-action button.
9. **`Skeleton`**: Subtle pulse loading placeholders for cards, statistics, and table rows.
10. **`Avatar`**: Role-tinted and brand-tinted initials avatar.
11. **`PageHeader`**: Standard page header containing title, one-line summary, breadcrumb trail, and right-aligned primary actions.
12. **`Input` / `Select` / `Textarea`**: Standardized `8px` rounded inputs with Deep Teal focus ring (`focus:border-teal-600 focus:ring-teal-500/20`).

---

## 4. App Shell & Navigation

- **Sidebar (`src/components/layout/sidebar.tsx`)**:
  - Brand header: "Guild Club Services" with Deep Teal activity emblem.
  - Role-specific plain-language navigation items (e.g. "Cases", "Therapists", "Reports", "Dashboard").
  - Removed all developer jargon, stage tags, and redundant labels.
  - **Desktop Collapsible**: Toggle button to collapse into an icon sidebar.
  - **Mobile Drawer**: Responsive drawer overlay with slide-in animation.
- **Topbar (`src/components/layout/topbar.tsx`)**:
  - Dynamic breadcrumb trail and section title.
  - DateSelector with Asia/Kolkata timezone indicator.
  - Notification bell button.
  - UserMenu with user avatar, name, role badge, "Change Password" link, and "Log out" action.

---

## 5. Dashboards: "One Screen, One Purpose"

### Super Admin Dashboard (`/super-admin/dashboard`)
- **Top Metrics**: Exactly 4 stat cards (Total Cases, Sessions Held, Success Rate, Active Therapists).
- **2 Main Panels**:
  - Caseload by Status chart (`Recharts` pie chart with semantic colors).
  - Staff Activity summary cards (compact cards with one-line summaries).
- **Tabbed Sub-Views**:
  - `Overview`: Charts, staff cards, and case lifecycle movements.
  - `Therapists`: Active therapist roster with direct directory link.
  - `Admins`: Registered administrators with quick "Add Admin" action.
  - `Reports`: Clinical intelligence and report links.
- Interactive drill-down drawer opens on any metric click.

### Admin Dashboard (`/admin/dashboard`)
- **Top Metrics**: Exactly 4 stat cards (Unassigned Cases, In Progress, Completed This Period, Available Therapists).
- **2 Main Panels**:
  - Cases Waiting for Assignment (with inline `Assign` button).
  - Therapist Workload capacity progress bars.
- **Primary Action**: `+ New case` in header.
- Case lifecycle movements and full staff activity accessible via sub-tabs.

### Therapist Dashboard (`/therapist/dashboard`)
- **Top Metrics**: Exactly 3 stat cards (My Active Cases, Sessions Today, Awaiting Response).
- **2 Main Panels**:
  - Today's Sessions & clinical output summary.
  - My Cases (Pending assignment invitations with Accept/Decline actions, and Active Caseload table).
- Cleanest and most focused dashboard designed for clinicians.

---

## 6. List and Form Pages

### Cases List (`/admin/cases`)
- Clean search & filter toolbar (search by case # or client name, filter by status, filter by priority).
- Sticky header table with maximum 6 columns:
  1. Case Number
  2. Client (Name + Phone)
  3. Category & Priority
  4. Assigned Therapist
  5. Status
  6. Action (`Manage`)

### Case Detail (`/admin/cases/[id]`)
- Top header with case number, status badge, priority badge, and back link.
- **2-Column Responsive Layout**:
  - **Left Area (2/3)**: Tabbed navigation:
    - `Overview`: Presenting issues, clinical description, status and outcome controls, therapist assignment.
    - `Sessions`: Session schedule and appointment notes.
    - `Clinical Notes`: Progress notes and add-note form.
    - `Audit History`: Timestamped chronological audit trail.
  - **Right Area (1/3)**: Side panel with client contact details and assigned therapist card.

### Forms (`Add Admin`, `Add Therapist`, `New Case`)
- Labeled, grouped sections (1-column on mobile, 2-column grid on desktop).
- Password input with live security strength indicator and password generator.
- Sticky bottom action footer with `Cancel` and `Save` buttons.
- Clear one-time credentials modal with individual "Copy Email", "Copy Password", and "Copy All" buttons.

### Login Page (`/login`)
- Modern **Split Layout**:
  - Left panel: Deep Teal brand presentation with platform highlights and geometric glow.
  - Right panel: Centered, clean login card with email, password with show/hide toggle, loading spinner, and inline error states.

---

## 7. Verification & Responsiveness
- Verified at **390px (Mobile)**, **768px (Tablet)**, and **1440px (Desktop)**.
- Zero horizontal scrolling.
- Automated Playwright screenshots generated in `test-results/screenshots-ui/`.
