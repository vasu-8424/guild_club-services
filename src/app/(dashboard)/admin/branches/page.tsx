import React from "react";
import { requireRole } from "@/lib/session";
import { getBranchesAction } from "@/lib/actions/branch-actions";
import { BranchesClient } from "@/components/branches/branches-client";

export const metadata = {
  title: "Branches | Guild Club Services",
};

export default async function AdminBranchesPage() {
  await requireRole("admin", "super_admin");

  const res = await getBranchesAction(true);
  const branches = res.success ? res.branches : [];

  return <BranchesClient initialBranches={branches} />;
}
