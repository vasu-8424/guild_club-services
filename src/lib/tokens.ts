/**
 * Guild Club Services - Sharp-Cornered Design System Tokens
 *
 * Core Principles:
 * - Sharp corners: 0px radius for cards, buttons, inputs, tables, dialogs, drawers, dropdowns, tabs, charts, tooltips.
 * - At most 2px radius on tiny inner elements: checkboxes, avatars, and small pills.
 * - Deep Teal brand scale: #0B7A63 to #0F9D7A.
 * - Restrained Chart Palette: Teal, Deep Indigo, Sky, Amber, Slate, Emerald, Rose.
 * - Cards: 1px border (#E2E8F0), 2px top accent line (#0B7A63) on key cards, subtle shadow [0_1px_0_rgba(15,23,42,0.04)].
 * - Typography: Inter / Geist, body 15px, card titles 17px semibold, numbers 36-44px tabular, labels 12px uppercase.
 */

export const tokens = {
  colors: {
    brand: {
      50: "#f0fdfa",
      100: "#ccfbf1",
      200: "#99f6e4",
      300: "#5eead4",
      400: "#2dd4bf",
      500: "#0F9D7A", // Secondary Teal Accent
      600: "#0B7A63", // Primary Deep Teal
      700: "#085d4b",
      800: "#064336",
      900: "#032d24",
      950: "#011712",
    },
    neutral: {
      50: "#f8fafc",
      100: "#f1f5f9",
      200: "#e2e8f0",
      300: "#cbd5e1",
      400: "#94a3b8",
      500: "#64748b",
      600: "#475569",
      700: "#334155",
      800: "#1e293b",
      900: "#0f172a",
      950: "#020617",
    },
    charts: {
      teal: "#0B7A63",
      tealLight: "#0F9D7A",
      indigo: "#4338CA",
      sky: "#0284C7",
      amber: "#D97706",
      slate: "#64748B",
      emerald: "#059669",
      rose: "#E11D48",
      palette: [
        "#0B7A63", // Teal
        "#4338CA", // Deep Indigo
        "#0284C7", // Sky
        "#D97706", // Amber
        "#059669", // Emerald
        "#64748B", // Slate
        "#E11D48", // Rose
      ],
    },
    status: {
      success: {
        bg: "bg-emerald-50",
        text: "text-emerald-800",
        border: "border-emerald-200",
        dot: "bg-emerald-600",
      },
      info: {
        bg: "bg-sky-50",
        text: "text-sky-800",
        border: "border-sky-200",
        dot: "bg-sky-600",
      },
      warning: {
        bg: "bg-amber-50",
        text: "text-amber-800",
        border: "border-amber-200",
        dot: "bg-amber-600",
      },
      danger: {
        bg: "bg-rose-50",
        text: "text-rose-800",
        border: "border-rose-200",
        dot: "bg-rose-600",
      },
      neutral: {
        bg: "bg-slate-50",
        text: "text-slate-800",
        border: "border-slate-200",
        dot: "bg-slate-500",
      },
    },
  },
  radii: {
    none: "rounded-none", // 0px everywhere standard
    input: "rounded-none", // 0px
    button: "rounded-none", // 0px
    card: "rounded-none", // 0px
    modal: "rounded-none", // 0px
    drawer: "rounded-none", // 0px
    badge: "rounded-[2px]", // at most 2px on tiny elements
    avatar: "rounded-[2px]", // square avatar with 2px radius
    checkbox: "rounded-[2px]", // 2px
    micro: "rounded-[2px]",
  },
  borders: {
    card: "border border-slate-200",
    cardAccent: "border border-slate-200 border-t-2 border-t-[#0B7A63]",
    divider: "border-b border-slate-200/80",
  },
  shadows: {
    card: "shadow-[0_1px_0_rgba(15,23,42,0.04)]",
    none: "shadow-none",
    dropdown: "shadow-[0_4px_12px_rgba(15,23,42,0.08)] border border-slate-200",
  },
  typography: {
    cardTitle: "text-[17px] font-semibold text-slate-900 tracking-tight",
    body: "text-[15px] leading-relaxed text-slate-700",
    bigNumber: "text-3xl sm:text-4xl font-semibold tabular-nums text-slate-900 tracking-tight",
    label: "text-[12px] font-semibold uppercase tracking-wider text-slate-500",
  },
} as const;

export type CaseStatusToken =
  | "new"
  | "assigned"
  | "accepted"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "cancelled";

export function getStatusStyle(status: string) {
  switch (status.toLowerCase()) {
    case "completed":
    case "discharged":
    case "active":
    case "held":
    case "sent":
    case "successful":
      return tokens.colors.status.success;
    case "in_progress":
    case "assigned":
    case "accepted":
    case "scheduled":
      return tokens.colors.status.info;
    case "on_hold":
    case "pending":
    case "high":
    case "medium":
    case "referred":
      return tokens.colors.status.warning;
    case "urgent":
    case "declined":
    case "failed":
    case "cancelled":
    case "deactivated":
    case "unsuccessful":
      return tokens.colors.status.danger;
    case "new":
    case "low":
    case "queued":
    default:
      return tokens.colors.status.neutral;
  }
}
