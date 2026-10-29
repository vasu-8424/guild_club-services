import React from "react";
import { requireRole } from "@/lib/session";
import { getScope } from "@/lib/scope";
import { CreateCaseForm } from "@/components/cases/create-case-form";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export const metadata = {
  title: "Create Case | Guild Club Services",
};

export default async function TherapistCreateCasePage() {
  const currentUser = await requireRole("therapist");
  const scope = await getScope(currentUser);

  // Only therapist's active branches, with the currently active branch preselected first
  const allowed = scope.allowedBranches;
  const branches = scope.activeBranch
    ? [
        scope.activeBranch,
        ...allowed.filter((b) => b.id !== scope.activeBranchId),
      ]
    : allowed;

  return (
    <DashboardShell user={currentUser} title="Create Case">
      <div className="py-6">
        <CreateCaseForm branches={branches as any} />
      </div>
    </DashboardShell>
  );
}
