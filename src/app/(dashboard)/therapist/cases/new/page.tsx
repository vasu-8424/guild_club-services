import React from "react";
import { requireRole } from "@/lib/session";
import { getBranchesAction } from "@/lib/actions/branch-actions";
import { CreateCaseForm } from "@/components/cases/create-case-form";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export const metadata = {
  title: "Create Case | Guild Club Services",
};

export default async function TherapistCreateCasePage() {
  const currentUser = await requireRole("therapist");

  const branchRes = await getBranchesAction(false);
  const branches = branchRes.success ? branchRes.branches : [];

  return (
    <DashboardShell user={currentUser} title="Create Case">
      <div className="py-6">
        <CreateCaseForm branches={branches} />
      </div>
    </DashboardShell>
  );
}
