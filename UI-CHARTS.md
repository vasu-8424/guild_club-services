# Guild Club Services — Visual Charts & Sharp-Corner Design System

## Overview & Architecture
This document details the presentation-layer upgrade of the **Guild Club Services** platform to a sharp-cornered visual command center. Both **Admin** and **Super Admin** dashboards now communicate operational and clinical status through rich, interactive Recharts visualizations rather than plain numbers.

---

## 1. Design Tokens (`/src/lib/tokens.ts` & `src/app/globals.css`)

### Sharp Corners (0px Mandate)
- **Border Radius**:
  - `0px` (`rounded-none`): Applied globally across all cards, containers, buttons, inputs, tables, dialogs, drawers, dropdowns, tabs, charts, and tooltips.
  - `2px` (`rounded-[2px]`): Reserved strictly for small inner elements: status pills, checkboxes, and square user avatars.
  - **No rounded circles or oval pills** anywhere in the application.

### Color Palette
- **Primary Brand (Deep Teal Scale)**:
  - Base: `#0B7A63` (`brand-600`)
  - Accent / Hover: `#0F9D7A` (`brand-500`)
  - Bottom Border (Crafted Edge): `#064336` (`brand-800`)
  - Tinted Background: `#0B7A63/10` or `#f0fdfa`
- **Chart Palette**:
  - Teal: `#0B7A63` (Intake & Primary Workload)
  - Deep Indigo: `#4338CA` (Secondary Dimension & Admins)
  - Sky: `#0284C7` (Assigned & Trends)
  - Amber: `#D97706` (On Hold & Attention Items)
  - Slate: `#64748B` (Baseline & New Cases)
  - Emerald: `#059669` (Completed & Discharged)
  - Rose: `#E11D48` (Urgent & Declined)

### Elevation & Surfaces
- **Cards**: Pure white background (`#FFFFFF`), `1px solid #E2E8F0`, subtle shadow `0 1px 0 rgba(15,23,42,0.04)`. Key cards feature a crisp `2px solid #0B7A63` top accent line.
- **Dividers**: Thin `1px` borders (`#E2E8F0/80`) on a consistent 24px gutter grid.

### Typography
- **Font Family**: Inter / Geist sans-serif.
- **Card Titles**: `17px font-semibold text-slate-900 tracking-tight`.
- **Large Metrics**: `36px to 44px font-semibold tabular-nums tracking-tight`.
- **Labels**: `12px font-bold uppercase tracking-wider text-slate-500`.
- **Body Text**: `15px text-slate-700 leading-relaxed`.
- **Contrast**: Guaranteed minimum 4.5:1 contrast against background.

---

## 2. Premium Phosphor Icons (`/src/components/ui/icons.ts`)
All icons are centralized in `/src/components/ui/icons.ts` utilizing `@phosphor-icons/react`:
- **Weights**:
  - `"duotone"`: Navigation menu items, stat cards, section headers, and metric tiles.
  - `"bold"`: Buttons, pagination controls, inline row actions, and toggles.
- **IconTile**:
  - `40px` square, `0px` radius, tinted background (`bg-[#0B7A63]/10`), and duotone icon in brand color.

---

## 3. Premium Button System (`/src/components/ui/button.tsx`)
Constructed with sharp corners (`rounded-none`), semibold text, and tactile feedback:
- **Primary**: Solid deep teal (`#0B7A63`), white text, `2px` darker bottom border (`#064336`), brightness change on hover, and small trailing arrow that slides `2px` on hover.
- **Secondary**: Crisp white background, `1px` slate border (`#CBD5E1`), teal border on hover.
- **Ghost**: Transparent background, slate hover state.
- **Destructive**: Deep crimson (`#BE123C`), `2px` darker bottom border (`#4C0519`).
- **Icon Button**: `40px` square (`h-10 w-10`), `1px` border.
- **Segmented Control** (`/src/components/ui/segmented-control.tsx`): Sharp joined segments for range filtering (Today / 7D / 30D / 90D / 12W) with active filled teal state.
- **Export Split Button** (`/src/components/ui/export-split-button.tsx`): Primary Export button joined with a dropdown trigger for Excel (.xlsx), PDF (.pdf), and CSV (.csv).

---

## 4. Recharts Component Library (`/src/components/charts/`)
Shared visual language across all charts: no heavy axes, light dotted horizontal grid (`stroke="#E2E8F0" strokeDasharray="3 3"`), 13px muted axis labels (`#64748B`), and sharp-cornered tooltip cards (`rounded-none border border-slate-300 bg-white p-2.5 shadow-md`).

| Component | Description | Key Props |
|---|---|---|
| `ChartContainer.tsx` | Common shell with 2px top accent line, kebab menu, skeleton state, and empty state. | `title`, `subtitle`, `icon`, `topAccent`, `onViewDetails`, `onExportCsv`, `isLoading`, `isEmpty` |
| `SparkStatCard.tsx` | Metric card with big tabular number, colored trend badge (+/- %), mini sparkline area, and "vs previous period" comparison. | `label`, `value`, `previousValue`, `changePercent`, `sparklineData`, `color`, `highlightWarning` |
| `RadialGauge.tsx` | Semicircular gauge displaying overall success rate against an 85% target marker, with a 3-way outcome split below (Success, Unsuccessful, Referred). | `percentage`, `target`, `successfulCount`, `unsuccessfulCount`, `referredCount`, `totalClosed` |
| `AreaTrendChart.tsx` | Smooth line with gradient fill, dot on hover, and optional dashed comparison line for the historical period. | `data`, `currentKey`, `previousKey`, `secondaryKey`, `currentLabel`, `previousLabel` |
| `DonutChart.tsx` | Thick ring with centered total and right-hand legend list showing square color marker, name, count, and percent. | `data`, `centerLabel`, `onSliceClick` |
| `FunnelChart.tsx` | Case pipeline throughput (New -> Assigned -> Accepted -> In Progress -> Completed) with count and drop-off percentage between stages. | `stages`, `onStageClick` |
| `StackedBarChart.tsx` | Workload/acuity distribution with flat fills, 0px radius, and column hover highlight. | `data`, `series`, `xAxisKey`, `onBarClick` |
| `HorizontalBarLeaderboard.tsx` | Ranked leaderboard with square avatar, name, sharp bar, and formatted metric value. | `items`, `maxVal`, `barColor`, `onItemClick` |
| `ActivityHeatmap.tsx` | GitHub-style 12-week CSS grid (84 days) with 5-step teal scale, live hover tooltip, and day-click dashboard navigation. | `days`, `selectedDate`, `onSelectDate` |
| `ProgressList.tsx` | Clinician caseload vs capacity (15 cases) with threshold colors (<70% green, 70-90% amber, >90% red). | `items`, `onItemClick` |

---

## 5. Super Admin Dashboard: "Command Center" (`/super-admin/dashboard`)
Layout on a 12-column grid with 24px gutters:
1. **Header**: Command Center title, live DateRangeChip, Segmented range toggle (Today / 7D / 30D / 90D / 12W), Split Export button, "+ Add Admin" primary button.
2. **Row 1 (4 SparkStatCards)**: Total Cases, Active Cases, Sessions Completed, Active Therapists.
3. **Row 2**:
   - `RadialGauge` (4 columns): Overall success rate with outcome split.
   - `AreaTrendChart` (8 columns): Cases created vs completed with previous-period comparison.
4. **Row 3**:
   - `FunnelChart` (6 columns): Case pipeline throughput across stages.
   - `DonutChart` (6 columns): Cases by status or clinical category with segmented toggle.
5. **Row 4**:
   - `StackedBarChart` (7 columns): Workload by therapist (sessions, notes, discharges).
   - `HorizontalBarLeaderboard` (5 columns): Top therapists by clinical success rate.
6. **Row 5**:
   - `ActivityHeatmap` (8 columns): Daily audit intensity across the last 12 weeks.
   - `HorizontalBarLeaderboard` (4 columns): Admin productivity (cases created and assigned).
7. **Row 6**:
   - `DataTable`: Team Activity & Governance Roster with square avatars, role badge, cases handled, sessions held, inline success rate bar, total actions, and status tag. Search, filter, sort, and pagination.
8. **Tabs**: Overview \| Admins \| Therapists \| Reports.

---

## 6. Admin Dashboard: "Operations" (`/admin/dashboard`)
1. **Header**: Operations title, DateRangeChip, Split Export button, "+ New Case" primary button.
2. **Row 1 (4 SparkStatCards)**:
   - Unassigned Cases (amber highlight when > 0).
   - In Progress (active caseload).
   - Completed This Period (successful closures).
   - Available Therapists (practitioner roster).
3. **Row 2**:
   - `StackedBarChart` (7 columns): Cases by priority and status cross-tabulation.
   - `DonutChart` (5 columns): Cases by clinical category.
4. **Row 3**:
   - `ProgressList` (5 columns): Therapist workload utilization against capacity thresholds.
   - `AreaTrendChart` (7 columns): New cases per day with previous-period comparison.
5. **Row 4**:
   - `FunnelChart` (5 columns): Assignment pipeline stages.
   - `Needs Attention Panel` (7 columns): Live list of overdue cases, unassigned urgent intakes, and declined cases with inline "Assign" buttons.
6. **Row 5**:
   - `DataTable`: Cases waiting for assignment with case number, client name, clinical focus, priority tag, created date, and inline Assign button.

---

## 7. Responsiveness & Accessibility
- **Breakpoints**:
  - `1440px`: Full 12-column grid layout.
  - `1024px`: 2-column stacked grid layout.
  - `768px`: 2 columns for stat cards, single column for charts.
  - `390px`: Single column; all charts maintain minimum `260px` height; tables scroll horizontally inside their own containers without page scroll.
- **Accessibility (WCAG 2.1 AA / Axe)**:
  - Chart containers provide structured `aria-label` summaries.
  - Interactive elements have explicit keyboard focus states (`focus-visible:ring-2 focus-visible:ring-[#0B7A63]`).
  - Color is never used as the sole indicator (accompanied by percentage badges, text labels, and icons).

---

## 8. Open Decisions & Notes
1. **Therapist Capacity Ceiling**: Set to 15 concurrent cases per clinician based on clinical guidelines; threshold colors trigger at 11 cases (70%) and 14 cases (90%).
2. **Date Timezone Boundary**: Strict Asia/Kolkata (`UTC+05:30`) boundary handling is maintained across all daily aggregations and near-midnight events.
