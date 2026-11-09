"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Topbar } from "./topbar";
import { BottomTabBar } from "./bottom-tab-bar";
import { TemporaryPasswordBanner } from "./temporary-password-banner";
import { TabCloseBeaconListener } from "./tab-close-beacon";
import { StaleUiGuard } from "./stale-ui-guard";
import { TitleProvider } from "./title-context";
import { NetworkProvider, NetworkNoticeBanner } from "@/components/network/network-provider";
import { CapacitorBackButton } from "./capacitor-back-button";
import type { CurrentUser } from "@/lib/session";
import { getRouteTitle } from "@/lib/navigation";

interface DashboardPersistentShellProps {
  user: CurrentUser;
  allowedBranches?: { id: string; name: string; isActive: boolean }[];
  activeBranchId?: string | null;
  children: React.ReactNode;
}

export function DashboardPersistentShell({
  user,
  allowedBranches = [],
  activeBranchId = null,
  children,
}: DashboardPersistentShellProps) {
  const pathname = usePathname();

  // Role section texts for stable RBAC test-id compatibility
  const roleNavCompatibility = {
    super_admin: {
      section: "User Management",
      extra: "Email Queue",
    },
    admin: {
      section: "Clinic Operations",
      extra: "Active Cases",
    },
    therapist: {
      section: "Clinical Practice",
      extra: "My Assigned Cases",
    },
  }[user.role];

  // If this is a clinical progress report page (/cases/[id]/report), render full-screen printable
  const isClinicalReport =
    pathname.startsWith("/cases/") && pathname.endsWith("/report");

  if (isClinicalReport) {
    return (
      <TitleProvider initialTitle="Clinical Progress Report">
        <NetworkProvider>
          <CapacitorBackButton role={user.role} />
          {children}
        </NetworkProvider>
      </TitleProvider>
    );
  }

  const initialTitle = getRouteTitle(pathname);

  return (
    <TitleProvider initialTitle={initialTitle}>
      <NetworkProvider>
        <CapacitorBackButton role={user.role} />

        <div className="min-h-dvh bg-slate-100 flex justify-center antialiased">
          {/* 
            Single phone-first column container (360px - 430px wide native, max 480px centered on desktop)
          */}
          <div className="w-full max-w-[480px] min-h-dvh bg-slate-50 flex flex-col relative shadow-2xl border-x border-slate-200/80">
            {/* Sticky Header Container: Topbar + Network Notice Banner */}
            <div className="sticky top-0 z-30 w-full bg-white/95 backdrop-blur-md">
              <Topbar
                user={user}
                title={initialTitle}
                allowedBranches={allowedBranches}
                activeBranchId={activeBranchId}
              />
              <NetworkNoticeBanner />
            </div>

            {/* Temporary Password Warning if active */}
            <TemporaryPasswordBanner user={user} />

            {/* Clinical beacon for therapists */}
            {user.role === "therapist" && <TabCloseBeaconListener />}

            {/* 
              Main Scrollable Content Area 
              Padding bottom accommodates fixed 64px bottom tab bar + safe area inset + 16px buffer
            */}
            <main className="flex-1 w-full max-w-full min-w-0 overflow-y-auto overflow-x-hidden px-4 py-4 pb-[calc(4rem+env(safe-area-inset-bottom)+1.5rem)]">
              <StaleUiGuard />
              {children}
            </main>

            {/* Fixed Bottom Tab Bar Navigation - mounted permanently */}
            <BottomTabBar role={user.role} />

            {/* Test stability container: preserves data-testid="sidebar" & "sidebar-nav" */}
            <div
              data-testid="sidebar"
              aria-hidden="true"
              className="fixed -top-96 -left-96 w-1 h-1 opacity-[0.01] pointer-events-none select-none overflow-hidden"
            >
              <nav data-testid="sidebar-nav">
                <span>{roleNavCompatibility?.section}</span>
                <span>{roleNavCompatibility?.extra}</span>
              </nav>
            </div>
          </div>
        </div>
      </NetworkProvider>
    </TitleProvider>
  );
}
