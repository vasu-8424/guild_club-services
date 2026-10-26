import { notFound } from "next/navigation";
import Link from "next/link";
import { eq, and, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, therapistProfiles, cases } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { EditTherapistForm } from "../edit-therapist-form";
import { ArrowLeft } from "lucide-react";

interface EditTherapistPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditTherapistPage({
  params,
}: EditTherapistPageProps) {
  const currentUser = await requireRole("admin", "super_admin");
  const { id } = await params;

  const [therapist] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      isActive: users.isActive,
      specialization: therapistProfiles.specialization,
      experienceYears: therapistProfiles.experienceYears,
      maxOpenCases: therapistProfiles.maxOpenCases,
    })
    .from(users)
    .innerJoin(therapistProfiles, eq(users.id, therapistProfiles.userId))
    .where(eq(users.id, id))
    .limit(1);

  if (!therapist) {
    notFound();
  }

  // Count active cases
  const [openCases] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(cases)
    .where(
      and(
        eq(cases.currentTherapistId, id),
        ne(cases.status, "completed")
      )
    );

  return (
    <DashboardShell user={currentUser} title={`Edit: ${therapist.name}`}>
      <div className="space-y-6">
        <div>
          <Link
            href={`/admin/therapists/${therapist.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Practitioner Details</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Edit Practitioner Profile
          </h1>
          <p className="text-sm text-slate-500">
            Update clinical details, capacity limits, and operational status for {therapist.name}.
          </p>
        </div>

        <EditTherapistForm
          therapist={{
            ...therapist,
            openCasesCount: openCases?.count ?? 0,
          }}
        />
      </div>
    </DashboardShell>
  );
}
