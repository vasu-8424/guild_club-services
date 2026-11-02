"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { NotificationBell } from "./notification-bell";
import { BranchSwitcher } from "./branch-switcher";
import { Icons } from "@/components/ui/icons";
import type { CurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

interface ScopeBranchOption {
  id: string;
  name: string;
  isActive: boolean;
}

interface TopbarProps {
  user: CurrentUser;
  title?: string;
  allowedBranches?: ScopeBranchOption[];
  activeBranchId?: string | null;
}

export function Topbar({
  user,
  title = "Dashboard",
  allowedBranches: initialBranches,
  activeBranchId: initialActiveBranchId,
}: TopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [branches, setBranches] = React.useState<ScopeBranchOption[]>(
    initialBranches || []
  );
  const [activeBranchId, setActiveBranchId] = React.useState<string | null>(
    initialActiveBranchId ?? null
  );

  React.useEffect(() => {
    if (initialBranches && initialBranches.length > 0) {
      setBranches(initialBranches);
      setActiveBranchId(initialActiveBranchId ?? null);
      return;
    }
    fetch("/api/scope")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.allowedBranches) {
          setBranches(data.allowedBranches);
          setActiveBranchId(data.activeBranchId);
        }
      })
      .catch(() => {});
  }, [initialBranches, initialActiveBranchId]);

  // Determine if this is an inner page that warrants a back button
  const rootRoutes = [
    "/therapist/dashboard",
    "/therapist/cases",
    "/therapist/notes",
    "/therapist/profile",
    "/admin/dashboard",
    "/admin/therapists",
    "/admin/rooms",
    "/admin/cases",
    "/notifications",
    "/super-admin/dashboard",
    "/admin/branches",
    "/super-admin/admins",
    "/super-admin/reports",
    "/super-admin/notifications",
  ];

  const isInnerPage = !rootRoutes.includes(pathname);

  // Active branch name
  const activeBranch = branches.find((b) => b.id === activeBranchId);
  const hasMultipleBranches = branches.length > 1;

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      if (user.role === "therapist") {
        router.push("/therapist/dashboard");
      } else if (user.role === "admin") {
        router.push("/admin/dashboard");
      } else {
        router.push("/super-admin/dashboard");
      }
    }
  };

  return (
    <header
      data-testid="topbar"
      className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-slate-200 bg-white/95 backdrop-blur-md px-3 sm:px-4 overscroll-contain select-none shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    >
      {/* Left: Optional Back Arrow + Title & Multi-Branch Chip */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {isInnerPage && (
          <button
            type="button"
            onClick={handleBack}
            data-testid="topbar-back-button"
            aria-label="Go back"
            className="flex h-10 w-10 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-none text-slate-700 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 transition-colors cursor-pointer touch-manipulation"
          >
            <Icons.ArrowLeft size={20} weight="bold" />
          </button>
        )}

        <div className="min-w-0 flex-1">
          <h1
            data-testid="topbar-title"
            className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight truncate block leading-tight"
          >
            {title}
          </h1>

          {/* Branch chip only shown when user has multiple branches */}
          {hasMultipleBranches && activeBranch && (
            <div className="mt-0.5 flex items-center">
              <span className="inline-flex items-center px-1.5 py-0.2 text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-none truncate max-w-[200px]">
                {activeBranch.name}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Right: Branch switcher (if multiple) & Notifications */}
      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        {hasMultipleBranches && (
          <BranchSwitcher
            allowedBranches={branches}
            activeBranchId={activeBranchId}
            role={user.role}
          />
        )}

        {/* Dynamic Notification Bell */}
        <NotificationBell userRole={user.role} />
      </div>
    </header>
  );
}
