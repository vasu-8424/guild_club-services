import Link from "next/link";
import { eq, and, ne, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, therapistProfiles, cases } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CreateCaseForm } from "./create-case-form";
import { ArrowLeft } from "lucide-react";

export default async function NewCasePage() {
  const currentUser = await requireRole("admin", "super_admin");

  // Fetch active therapists (excluding deleted)
  const activeTherapists = await db
    .select({
      id: users.id,
      name: users.name,
      specialization: therapistProfiles.specialization,
      maxOpenCases: therapistProfiles.maxOpenCases,
    })
    .from(users)
    .innerJoin(therapistProfiles, eq(users.id, therapistProfiles.userId))
    .where(and(eq(users.role, "therapist"), eq(users.isActive, true), isNull(users.deletedAt)))
    .orderBy(users.name);

  // Fetch their open case count
  const openCasesCounts = await db
    .select({
      therapistId: cases.currentTherapistId,
      count: sql<number>`count(*)::int`,
    })
    .from(cases)
    .where(
      and(
        isNotNull(cases.currentTherapistId),
        ne(cases.status, "completed")
      )
    )
    .groupBy(cases.currentTherapistId);

  const openCasesMap = new Map<string, number>();
  for (const row of openCasesCounts) {
    if (row.therapistId) {
      openCasesMap.set(row.therapistId, row.count);
    }
  }

  const therapistsWithCapacity = activeTherapists.map((t) => ({
    id: t.id,
    name: t.name,
    specialization: t.specialization,
    maxOpenCases: t.maxOpenCases,
    openCases: openCasesMap.get(t.id) ?? 0,
  }));

  return (
    <DashboardShell user={currentUser} title="New Case Intake">
      <div className="space-y-6">
        <div>
          <Link
            href="/admin/cases"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Cases Directory</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Client Intake & Case Registration
          </h1>
          <p className="text-sm text-slate-500">
            Register a new client, define presenting symptoms, set triage priority, and assign to a practitioner.
          </p>
        </div>

        <CreateCaseForm therapists={therapistsWithCapacity} />
      </div>
    </DashboardShell>
  );
}
