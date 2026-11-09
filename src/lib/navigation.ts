import type { UserRole } from "@/db/schema";
import { Icons } from "@/components/ui/icons";
import type { IconProps } from "@phosphor-icons/react";
import type * as React from "react";

export interface NavItemConfig {
  key: string;
  label: string;
  href: string;
  icon: (props: IconProps) => React.ReactNode;
  testId: string;
  aliases?: string[];
  matchPrefixes?: string[];
  badgeKey?: "unreadNotes" | "unreadAlerts";
  exact?: boolean;
}

export interface NavSectionConfig {
  section: string;
  items: {
    title: string;
    href: string;
    icon: (props: IconProps) => React.ReactNode;
    testId?: string;
    badgeKey?: "unreadNotes" | "unreadAlerts";
  }[];
}

// Single source of truth for Role Dashboards
export function getRoleDashboardPath(role: UserRole): string {
  switch (role) {
    case "therapist":
      return "/therapist/dashboard";
    case "admin":
      return "/admin/dashboard";
    case "super_admin":
      return "/super-admin/dashboard";
    default:
      return "/login";
  }
}

// Single source of truth for Bottom Tab Items per role
export const ROLE_TAB_CONFIG: Record<UserRole, NavItemConfig[]> = {
  therapist: [
    {
      key: "today",
      label: "Today",
      href: "/therapist/dashboard",
      icon: Icons.Dashboard,
      testId: "tab-therapist-today",
      aliases: ["tab-dashboard"],
      exact: true,
    },
    {
      key: "patients",
      label: "Patients",
      href: "/therapist/cases",
      icon: Icons.Cases,
      testId: "tab-therapist-patients",
      aliases: ["tab-cases"],
      matchPrefixes: ["/therapist/cases", "/cases/"],
    },
    {
      key: "notes",
      label: "Notes",
      href: "/therapist/notes",
      icon: Icons.Envelope,
      testId: "tab-therapist-notes",
      badgeKey: "unreadNotes",
      matchPrefixes: ["/therapist/notes"],
    },
    {
      key: "profile",
      label: "Profile",
      href: "/profile",
      icon: Icons.User,
      testId: "tab-therapist-profile",
      aliases: ["tab-profile", "tab-settings"],
      matchPrefixes: ["/profile", "/therapist/profile"],
    },
  ],

  admin: [
    {
      key: "dashboard",
      label: "Dashboard",
      href: "/admin/dashboard",
      icon: Icons.Dashboard,
      testId: "tab-dashboard",
      exact: true,
    },
    {
      key: "therapists",
      label: "Therapists",
      href: "/admin/therapists",
      icon: Icons.Therapists,
      testId: "tab-therapists",
      matchPrefixes: ["/admin/therapists"],
    },
    {
      key: "cases",
      label: "Cases",
      href: "/admin/cases",
      icon: Icons.Cases,
      testId: "tab-cases",
      matchPrefixes: ["/admin/cases", "/cases/"],
    },
    {
      key: "profile",
      label: "Profile",
      href: "/profile",
      icon: Icons.User,
      testId: "tab-profile",
      aliases: ["tab-admin-profile", "tab-settings"],
      matchPrefixes: ["/profile", "/admin/profile"],
    },
  ],

  super_admin: [
    {
      key: "dashboard",
      label: "Dashboard",
      href: "/super-admin/dashboard",
      icon: Icons.Dashboard,
      testId: "tab-dashboard",
      exact: true,
    },
    {
      key: "branches",
      label: "Branches",
      href: "/super-admin/branches",
      icon: Icons.Buildings,
      testId: "tab-branches",
      matchPrefixes: ["/super-admin/branches", "/admin/branches"],
    },
    {
      key: "admins",
      label: "Admins",
      href: "/super-admin/admins",
      icon: Icons.Admins,
      testId: "tab-admins",
      matchPrefixes: ["/super-admin/admins"],
    },
    {
      key: "reports",
      label: "Reports",
      href: "/super-admin/reports",
      icon: Icons.Reports,
      testId: "tab-reports",
      matchPrefixes: ["/super-admin/reports"],
    },
    {
      key: "profile",
      label: "Profile",
      href: "/profile",
      icon: Icons.User,
      testId: "tab-profile",
      aliases: ["tab-settings", "tab-more"],
      matchPrefixes: ["/profile", "/super-admin/profile"],
    },
  ],
};

// Single source of truth for Sidebar Navigation per role
export const ROLE_SIDEBAR_CONFIG: Record<UserRole, NavSectionConfig[]> = {
  therapist: [
    {
      section: "Practice",
      items: [
        {
          title: "Dashboard",
          href: "/therapist/dashboard",
          icon: Icons.Dashboard,
          testId: "sidebar-therapist-dashboard",
        },
        {
          title: "My Patients",
          href: "/therapist/cases",
          icon: Icons.Cases,
          testId: "sidebar-therapist-cases",
        },
        {
          title: "Notes from Admin",
          href: "/therapist/notes",
          icon: Icons.Envelope,
          testId: "sidebar-therapist-notes",
          badgeKey: "unreadNotes",
        },
        {
          title: "Profile",
          href: "/profile",
          icon: Icons.User,
          testId: "sidebar-therapist-profile",
        },
      ],
    },
  ],

  admin: [
    {
      section: "Navigation",
      items: [
        {
          title: "Dashboard",
          href: "/admin/dashboard",
          icon: Icons.Dashboard,
          testId: "sidebar-admin-dashboard",
        },
        {
          title: "Therapists",
          href: "/admin/therapists",
          icon: Icons.Therapists,
          testId: "sidebar-admin-therapists",
        },
        {
          title: "Cases",
          href: "/admin/cases",
          icon: Icons.Cases,
          testId: "sidebar-admin-cases",
        },
        {
          title: "Notifications",
          href: "/notifications",
          icon: Icons.Alert,
          testId: "sidebar-admin-notifications",
        },
        {
          title: "Profile & Settings",
          href: "/profile",
          icon: Icons.User,
          testId: "sidebar-admin-profile",
        },
      ],
    },
  ],

  super_admin: [
    {
      section: "Overview",
      items: [
        {
          title: "Dashboard",
          href: "/super-admin/dashboard",
          icon: Icons.Dashboard,
          testId: "sidebar-super-dashboard",
        },
        {
          title: "Profile & Settings",
          href: "/profile",
          icon: Icons.User,
          testId: "sidebar-super-profile",
        },
      ],
    },
    {
      section: "Management",
      items: [
        {
          title: "Cases",
          href: "/admin/cases",
          icon: Icons.Cases,
          testId: "sidebar-super-cases",
        },
        {
          title: "Therapists",
          href: "/admin/therapists",
          icon: Icons.Therapists,
          testId: "sidebar-super-therapists",
        },
        {
          title: "Rooms",
          href: "/super-admin/rooms",
          icon: Icons.Door,
          testId: "sidebar-super-rooms",
        },
        {
          title: "Admins",
          href: "/super-admin/admins",
          icon: Icons.Admins,
          testId: "sidebar-super-admins",
        },
        {
          title: "Branches",
          href: "/super-admin/branches",
          icon: Icons.Buildings,
          testId: "sidebar-super-branches",
        },
        {
          title: "Notifications",
          href: "/notifications",
          icon: Icons.Alert,
          testId: "sidebar-super-notifications",
        },
      ],
    },
    {
      section: "Insights",
      items: [
        {
          title: "Reports",
          href: "/super-admin/reports",
          icon: Icons.Reports,
          testId: "sidebar-super-reports",
        },
        {
          title: "Delivery & Quota",
          href: "/super-admin/notifications",
          icon: Icons.Analytics,
          testId: "sidebar-super-delivery",
        },
      ],
    },
  ],
};

// Check if a tab item is active based on pathname
export function isTabActive(tab: NavItemConfig, pathname: string): boolean {
  if (tab.exact) {
    return pathname === tab.href;
  }
  if (pathname === tab.href) {
    return true;
  }
  if (tab.matchPrefixes && tab.matchPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }
  if (tab.href !== "/profile" && pathname.startsWith(tab.href)) {
    return true;
  }
  if (tab.href === "/profile" && (pathname === "/profile" || pathname.endsWith("/profile"))) {
    return true;
  }
  return false;
}

// Map known routes to clean page titles
export const ROUTE_TITLE_MAP: Record<string, string> = {
  "/therapist/dashboard": "Today's Sessions",
  "/therapist/cases": "My Patients",
  "/therapist/cases/new": "Create New Case",
  "/therapist/notes": "Clinical Notes",
  "/therapist/profile": "Profile & Settings",
  "/admin/dashboard": "Dashboard",
  "/admin/therapists": "Therapists",
  "/admin/therapists/new": "Add Therapist",
  "/admin/cases": "Cases",
  "/admin/cases/new": "Create New Case",
  "/admin/rooms": "Rooms",
  "/super-admin/dashboard": "Dashboard",
  "/super-admin/branches": "Branches",
  "/super-admin/admins": "Admins",
  "/super-admin/admins/new": "Add Administrator",
  "/super-admin/reports": "Reports",
  "/super-admin/rooms": "Rooms",
  "/super-admin/notifications": "Delivery & Quota",
  "/profile": "Profile & Settings",
  "/notifications": "Notifications",
};

export function getRouteTitle(pathname: string, defaultTitle = "Dashboard"): string {
  if (ROUTE_TITLE_MAP[pathname]) {
    return ROUTE_TITLE_MAP[pathname];
  }
  if (pathname.includes("/report")) {
    return "Clinical Progress Report";
  }
  if (pathname.startsWith("/admin/therapists/")) {
    return "Therapist Profile";
  }
  if (pathname.startsWith("/admin/cases/")) {
    return "Case Details";
  }
  if (pathname.startsWith("/therapist/cases/")) {
    return "Patient Overview";
  }
  if (pathname.startsWith("/super-admin/admins/")) {
    return "Admin Details";
  }
  return defaultTitle;
}

