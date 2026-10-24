import * as React from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import type { CurrentUser } from "@/lib/session";

interface DashboardShellProps {
  user: CurrentUser;
  title: string;
  children: React.ReactNode;
}

export function DashboardShell({
  user,
  title,
  children,
}: DashboardShellProps) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar with role-specific menu */}
      <Sidebar role={user.role} userName={user.name} />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar user={user} title={title} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
