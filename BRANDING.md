# Guild Club Services — Mobile Design & Branding System

## 1. Palette & Contrast (WCAG AA Compliant)

| Token | Hex / Class | Description & Usage | Contrast vs White / Surface |
|---|---|---|---|
| **Brand Teal** | `#0B7A63` | Primary brand color, key actions, active bottom-tab indicators, active borders | 4.8:1 (Passes AA) |
| **Brand Teal Dark** | `#085A49` | Pressed / active state for primary buttons | 7.1:1 (Passes AAA) |
| **Brand Teal Tint** | `#E6F5F1` | Background fill for selected items and active tabs | Tint surface |
| **Ink Text Primary** | `#0F172A` (Slate-900) | Headings, primary labels, main body text | 16.1:1 (Passes AAA) |
| **Ink Text Secondary** | `#475569` (Slate-600) | Secondary text, captions, timestamps | 5.9:1 (Passes AA) |
| **Ink Text Muted** | `#64748B` (Slate-500) | Field placeholders, inactive tab icons | 4.6:1 (Passes AA) |
| **Surface Background** | `#F8FAFC` (Slate-50) | App background, phone container canvas | Light neutral canvas |
| **Surface Card** | `#FFFFFF` | Card surfaces, modals, bottom sheets | Pure white |
| **Border Neutral** | `#E2E8F0` (Slate-200) | Card outlines, dividers, table borders | High contrast divider |
| **Border Active** | `#CBD5E1` (Slate-300) | Input borders resting state | Clear form boundary |

### Status Colors (Always paired with an Icon + Text Label)
- **Active / Success / Completed**:
  - Background: `#ECFDF5` (`bg-emerald-50`)
  - Text: `#047857` (`text-emerald-700`)
  - Border: `#A7F3D0` (`border-emerald-200`)
  - Icon: `CheckCircle` or `Check`
- **In Progress / Warning / Pending**:
  - Background: `#FFFBEB` (`bg-amber-50`)
  - Text: `#B45309` (`text-amber-700`)
  - Border: `#FDE68A` (`border-amber-200`)
  - Icon: `Clock` or `Hourglass`
- **Critical / Overdue / Destructive / Inactive**:
  - Background: `#FFF1F2` (`bg-rose-50`)
  - Text: `#BE123C` (`text-rose-700`)
  - Border: `#FECDD3` (`border-rose-200`)
  - Icon: `XCircle` or `WarningOctagon`
- **Scheduled / Info / Neutral**:
  - Background: `#F0F9FF` (`bg-sky-50`)
  - Text: `#0369A1` (`text-sky-700`)
  - Border: `#BAE6FD` (`border-sky-200`)
  - Icon: `Calendar` or `Info`

---

## 2. Typography Scale (Strict Mobile Ergonomics)

- **Important Headings**: `text-[28px] font-semibold leading-tight tracking-tight` (Patient header, session status, report titles)
- **Page Titles**: `text-[24px] font-semibold leading-tight tracking-tight` (Screen main title)
- **Section Headings**: `text-[18px] font-semibold leading-snug tracking-tight` (Card headers, form step titles)
- **Body Text**: `text-[16px] font-normal leading-relaxed` (Paragraphs, clinical notes, patient details)
- **Form Labels**: `text-[14px] font-semibold tracking-wide uppercase text-slate-700`
- **Captions & Helpers**: `text-[13px] font-medium leading-normal text-slate-500` (Never smaller than 13px)
- **Tab Bar Labels**: `text-[12px] font-medium leading-tight`
- **Counters & Metric Numbers**: `text-[32px] sm:text-[36px] font-bold tabular-nums tracking-tight`

---

## 3. Sharp Corners (Geometry)
- Buttons: `rounded-none` (0px radius) or `rounded-[2px]` max.
- Cards: `rounded-none` (0px radius) with `border border-slate-200 shadow-[0_1px_0_rgba(15,23,42,0.04)]`.
- Inputs: `rounded-none` (0px radius) with `border border-slate-300`.
- Badges & Chips: `rounded-none` (0px radius).

---

## 4. Touch Targets & Virtual Keyboard
- Minimum touch target: `48px` x `48px` with at least `8px` gap between targets.
- Primary full-width buttons: `h-[52px]` on mobile devices.
- Inputs: Minimum `16px` font size (`text-base`) to prevent iOS automatic zoom.
- Keyboard Handling: Sticky action bars float above keyboard using `visualViewport` listener.
- Bottom Sheet Confirmations: Replaces destructive modals on mobile.

