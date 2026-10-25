# Guild Club Services — Button Component & Table Actions Design System

## Overview
This document defines the single source of truth for all buttons, icon alignments, and table row actions across Guild Club Services. Every button in the application must use the shared `<Button>` component (`src/components/ui/button.tsx`) and adhere to the strict presentation rules below.

---

## The 4 Strict Layout Rules

1. **Sharp Corners (0px border-radius)**
   - All buttons must strictly use `rounded-none`. No rounded corners (`rounded-md`, `rounded-full`, etc.) are permitted anywhere in the UI (maximum 2px only on tiny status badges or avatars).

2. **Fixed Height Hierarchy (Horizontal padding only, zero vertical padding)**
   - Buttons are governed by strict fixed heights:
     - `sm`: **36px** (`h-[36px] px-3 gap-[6px] text-[14px]`)
     - `md`: **44px** (`h-[44px] px-4 gap-[8px] text-[14px] sm:text-[15px]`)
     - `lg`: **48px** (`h-[48px] px-5 gap-[8px] text-[15px]`)
     - `icon`: **40px × 40px** (`h-[40px] w-[40px] p-0`)
     - `icon-sm`: **36px × 36px** (`h-[36px] w-[36px] p-0`)
   - Never override height, display, or flex-direction via `className`.

3. **Never Wrap onto Multiple Lines**
   - Button text must stay on a single line under all viewport widths: `whitespace-nowrap leading-none truncate select-none font-semibold`.
   - Never nest `<br />` or multi-line text inside buttons.

4. **Icons Passed Exclusively via Props**
   - **NEVER** render icons manually inside children (e.g. `<Button><Icon /> Text</Button>`). Manual SVG children lack proper flex container bounds, which causes icons to sit above labels or break onto new lines.
   - **ALWAYS** pass icons via the `leadingIcon` (or alias `icon`) and `trailingIcon` props.
   - When `isLoading={true}` is set, a loading spinner automatically takes the place of the `leadingIcon` while preserving button dimensions.

---

## Button API Reference

```tsx
import { Button } from "@/components/ui/button";
import { Plus, ArrowRight } from "lucide-react"; // or Icons from "@/components/ui/icons"

<Button
  variant="primary"        // "primary" | "secondary" | "outline" | "ghost" | "destructive" | "destructive-outline" | "warning-outline" | "link" | "icon"
  size="sm"               // "sm" (36px) | "md" (44px) | "lg" (48px) | "icon" (40px) | "icon-sm" (36px)
  leadingIcon={<Plus />}  // Icon placed before text (16px in sm, 18px in md/lg)
  trailingIcon={<ArrowRight />} // Icon placed after text
  isLoading={false}       // Replaces leadingIcon with spinner & disables interactions
  disabled={false}
>
  Button Label
</Button>
```

### Variant Guidelines

| Variant | Visual Appearance | Primary Use Cases |
| :--- | :--- | :--- |
| `primary` | Solid deep teal (`#0B7A63`), 2px bottom border (`#064336`), white text | Main call-to-action on a page, form submit, "New Case", "Register Therapist", "Assign" |
| `secondary` | Crisp white, 1px slate border (`#CBD5E1`), teal hover border | Primary row action in tables ("Assign room", "Edit"), Cancel buttons, Filter reset |
| `outline` | Transparent with 1px slate border, dark slate hover | Secondary navigation or alternative actions |
| `ghost` | Transparent background, subtle slate hover | Table kebab action trigger, modal close button, topbar icons |
| `destructive` | Deep rose red background with dark red bottom border | Final confirmation of deletion, irrevocable actions |
| `destructive-outline` | White background with rose border and red text | "Cancel Session", non-final destructive triggers |
| `warning-outline` | White background with amber border and amber text | "Reset Password", "Mark Missed Session" |
| `link` | Transparent, teal text with underline on hover | Sub-links (e.g., "Sign out instead" on change-password page) |
| `icon` | 40px or 36px square with border | Standalone icon actions with `aria-label` |

---

## Table Row Actions Pattern: The Kebab Dropdown

To prevent table rows from becoming crowded with 4-5 buttons that break onto multiple lines:
1. Every table row must have an **Actions column fixed at `220px`**, right-aligned with `whitespace-nowrap`.
2. Render **exactly ONE visible primary action button** (e.g., "Assign room" for therapists, "Assign" or "View" for cases, "Edit" for admins).
3. Place all other secondary, administrative, and dangerous actions inside a sharp-cornered kebab dropdown menu (`RowActionsMenu` from `@/components/ui/row-actions-menu`).
4. Dangerous actions (e.g., Delete) must be separated by a divider line and styled with `variant: "destructive"`.
5. The kebab dropdown must support:
   - Dismissal on **Escape** key press
   - Dismissal on **outside click**
   - Keyboard arrow key navigation (`ArrowDown`, `ArrowUp`, `Home`, `End`)

### Row Actions Implementation Example

```tsx
import { Button } from "@/components/ui/button";
import { RowActionsMenu, type RowActionMenuItem } from "@/components/ui/row-actions-menu";
import { Door, Pencil, KeyRound, Trash } from "lucide-react";

export function PractitionerRowActions({ therapist }: { therapist: Therapist }) {
  const menuItems: RowActionMenuItem[] = [
    {
      key: "edit",
      label: "Edit details",
      icon: <Pencil className="h-4 w-4" />,
      onClick: () => router.push(`/admin/therapists/${therapist.id}`),
    },
    {
      key: "reset-password",
      label: "Reset password",
      icon: <KeyRound className="h-4 w-4" />,
      onClick: () => setShowResetModal(true),
    },
    {
      key: "delete",
      label: "Delete practitioner",
      icon: <Trash className="h-4 w-4" />,
      variant: "destructive",
      isDividerBefore: true,
      onClick: () => setShowDeleteModal(true),
    },
  ];

  return (
    <div className="flex items-center justify-end gap-2 w-full max-w-[220px] ml-auto">
      {/* 1 Visible Primary Action */}
      <Button
        variant="secondary"
        size="sm"
        leadingIcon={<Door className="h-4 w-4" />}
        onClick={() => setShowRoomModal(true)}
      >
        Assign room
      </Button>

      {/* Kebab Dropdown for More Actions */}
      <RowActionsMenu
        items={menuItems}
        triggerTestId={`row-actions-kebab-${therapist.id}`}
        buttonTitle="More actions"
      />
    </div>
  );
}
```

---

## Form Footer Pattern

Form action buttons must follow this consistent layout:
- **Desktop**: Cancel (secondary) on the left, Save/Submit (primary) on the right:
  ```tsx
  <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-6 border-t border-slate-200">
    <Button
      type="button"
      variant="secondary"
      onClick={() => router.back()}
      className="w-full sm:w-auto"
    >
      Cancel
    </Button>
    <Button
      type="submit"
      variant="primary"
      isLoading={isSubmitting}
      className="w-full sm:w-auto"
    >
      Save Changes
    </Button>
  </div>
  ```
- **Mobile (`<640px`)**: Full-width buttons stacked vertically with Save on top (`flex-col-reverse`).

---

## Visual Testing Gallery

A dedicated interactive gallery is available at `/dev/buttons`.
It showcases:
- All 9 variants across small, medium, and large sizes
- Leading and trailing icon placements
- Loading spinner states
- Disabled states
- Square icon-only buttons
- Narrow container stress tests (200px and 120px) verifying that labels truncate cleanly without breaking the fixed height

---

## Automated Playwright Visual Spec

Playwright spec at `tests/e2e/buttons-visual.spec.ts`:
- Verifies exact button heights (`36px`, `40px`, `44px`, `48px` within subpixel tolerances).
- Asserts that icons and text nodes never overlap horizontally.
- Verifies single-line text constraint (`textBox.height <= 24px`).
- Tests kebab dropdown opening, keyboard Escape dismissal, and outside click dismissal.
- Validates responsiveness across 1440px, 1024px, 768px, and 390px viewports.
- Generates reference screenshots into `test-results/screenshots-ui/`.
