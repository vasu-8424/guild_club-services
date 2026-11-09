import * as React from "react";
import { requireRole } from "@/lib/session";
import { getScope } from "@/lib/scope";
import { DashboardPersistentShell } from "@/components/layout/dashboard-persistent-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("therapist", "admin", "super_admin");

  let allowedBranches: { id: string; name: string; isActive: boolean }[] = [];
  let activeBranchId: string | null = null;

  try {
    const scope = await getScope(user);
    allowedBranches = scope.allowedBranches;
    activeBranchId = scope.activeBranchId;
  } catch {
    // If scope resolution fails, fall back to empty
  }

  return (
    <DashboardPersistentShell
      user={user}
      allowedBranches={allowedBranches}
      activeBranchId={activeBranchId}
    >
      {children}
    </DashboardPersistentShell>
  );
}
