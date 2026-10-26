"use client";

import * as React from "react";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";
import { DateSelector } from "@/components/dashboard/date-selector";
import type { CurrentUser } from "@/lib/session";
import { usePathname } from "next/navigation";

interface TopbarProps {
  user: CurrentUser;
  title?: string;
}

export function Topbar({ user, title = "Dashboard" }: TopbarProps) {
  const pathname = usePathname();

  // Generate plain breadcrumbs based on pathname
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumb =
    segments.length > 1
      ? segments.map((s) => s.replace(/-/g, " ")).join(" / ")
      : "Portal / " + title;

  return (
    <header
      data-testid="topbar"
      className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 shadow-[0_1px_0_rgba(15,23,42,0.04)]"
    >
      {/* Left: Breadcrumbs & Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <nav
            aria-label="Breadcrumb"
            className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate hidden sm:block"
          >
            {breadcrumb}
          </nav>
          <h1
            data-testid="topbar-title"
            className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight truncate"
          >
            {title}
          </h1>
        </div>
      </div>

      {/* Right: Date Selector, Notifications, User Menu */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Date Selector */}
        <DateSelector />

        {/* Dynamic Notification Bell with Dropdown & Polling */}
        <NotificationBell userRole={user.role} />

        {/* Vertical divider */}
        <div className="h-6 w-px bg-slate-200" />

        {/* User Profile Menu with Logout & Change Password */}
        <UserMenu
          user={{
            name: user.name,
            email: user.email,
            role: user.role,
          }}
        />
      </div>
    </header>
  );
}
