import * as React from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { TemporaryPasswordBanner } from "./temporary-password-banner";
import { TabCloseBeaconListener } from "./tab-close-beacon";
import type { CurrentUser } from "@/lib/session";
import { getScope } from "@/lib/scope";

interface DashboardShellProps {
  user: CurrentUser;
  title: string;
  children: React.ReactNode;
}

export async function DashboardShell({
  user,
  title,
  children,
}: DashboardShellProps) {
  let allowedBranches: { id: string; name: string; isActive: boolean }[] = [];
  let activeBranchId: string | null = null;

  try {
    const scope = await getScope(user);
    allowedBranches = scope.allowedBranches;
    activeBranchId = scope.activeBranchId;
  } catch {
    // If scope resolution fails gracefully fall back to empty
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar with role-specific menu */}
      <Sidebar role={user.role} userName={user.name} />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          user={user}
          title={title}
          allowedBranches={allowedBranches}
          activeBranchId={activeBranchId}
        />
        <TemporaryPasswordBanner user={user} />
        {user.role === "therapist" && <TabCloseBeaconListener />}

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
