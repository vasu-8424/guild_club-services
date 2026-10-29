import Link from "next/link";
import { requireRole } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CreateTherapistForm } from "./create-therapist-form";
import { ArrowLeft } from "lucide-react";
import { getScope } from "@/lib/scope";

export default async function NewTherapistPage() {
  const currentUser = await requireRole("admin", "super_admin");
  const scope = await getScope(currentUser);

  return (
    <DashboardShell user={currentUser} title="Register Therapist">
      <div className="space-y-6">
        <div>
          <Link
            href="/admin/therapists"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Directory</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Register New Practitioner
          </h1>
          <p className="text-sm text-slate-500">
            Create a clinician account with branch assignment, case capacity limits, and clinical specializations.
          </p>
        </div>

        <CreateTherapistForm
          branches={scope.allowedBranches}
          defaultBranchId={scope.activeBranchId || scope.allowedBranches[0]?.id}
        />
      </div>
    </DashboardShell>
  );
}
