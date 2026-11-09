import React from "react";
import { requireRole } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getBranchesAction } from "@/lib/actions/branch-actions";
import { BranchesClient } from "@/components/branches/branches-client";

export const metadata = {
  title: "Branches | Guild Club Services",
};

export default async function SuperAdminBranchesPage() {
  const user = await requireRole("super_admin");

  const res = await getBranchesAction(true);
  const branches = res.success ? res.branches : [];

  return (
    <DashboardShell user={user} title="Branches">
      <BranchesClient initialBranches={branches} />
    </DashboardShell>
  );
}
