import Link from "next/link";
import { requireRole } from "@/lib/session";
import { getScope } from "@/lib/scope";
import { db } from "@/db";
import { branches } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CreateAdminForm } from "./create-admin-form";
import { ArrowLeft } from "lucide-react";

export default async function NewAdminPage() {
  const currentUser = await requireRole("super_admin");
  const scope = await getScope(currentUser);

  // Fetch only active branches
  const activeBranches = await db
    .select({
      id: branches.id,
      name: branches.name,
      isActive: branches.isActive,
    })
    .from(branches)
    .where(eq(branches.isActive, true))
    .orderBy(asc(branches.name));

  return (
    <DashboardShell user={currentUser} title="Create Administrator">
      <div className="space-y-6">
        <div>
          <Link
            href="/super-admin/admins"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Administrators</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Register New Administrator
          </h1>
          <p className="text-sm text-slate-500">
            Create a staff profile with administrative privileges across Guild Club Services.
          </p>
        </div>

        <CreateAdminForm
          branches={activeBranches}
          defaultBranchId={scope.activeBranchId}
        />
      </div>
    </DashboardShell>
  );
}
