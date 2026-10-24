import Link from "next/link";
import { requireRole } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CreateAdminForm } from "./create-admin-form";
import { ArrowLeft } from "lucide-react";

export default async function NewAdminPage() {
  const currentUser = await requireRole("super_admin");

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

        <CreateAdminForm />
      </div>
    </DashboardShell>
  );
}
