import Link from "next/link";
import { eq, desc, sql, ne, and, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users, therapistProfiles, cases } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { UserPlus, AlertTriangle } from "lucide-react";
import { TherapistRowActions } from "./therapist-row-actions";

interface TherapistsListPageProps {
  searchParams: Promise<{ showDeleted?: string }>;
}

export default async function TherapistsListPage({
  searchParams,
}: TherapistsListPageProps) {
  const currentUser = await requireRole("admin", "super_admin");
  const params = await searchParams;
  const isSuperAdmin = currentUser.role === "super_admin";
  const showDeleted = isSuperAdmin && params.showDeleted === "true";

  const condition = showDeleted
    ? eq(users.role, "therapist")
    : and(eq(users.role, "therapist"), isNull(users.deletedAt));

  // Fetch therapists with their profiles
  const therapistList = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      isActive: users.isActive,
      deletedAt: users.deletedAt,
      specialization: therapistProfiles.specialization,
      experienceYears: therapistProfiles.experienceYears,
      maxOpenCases: therapistProfiles.maxOpenCases,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(therapistProfiles, eq(users.id, therapistProfiles.userId))
    .where(condition)
    .orderBy(desc(users.createdAt));

  // Fetch open case counts per therapist
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

  return (
    <DashboardShell user={currentUser} title="Therapists">
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title="Therapists"
          description="Manage clinical practitioners, specializations, case capacity, and operational status."
          breadcrumbs={[
            {
              label: "Dashboard",
              href: isSuperAdmin ? "/super-admin/dashboard" : "/admin/dashboard",
            },
            { label: "Therapists" },
          ]}
          action={
            <div className="flex items-center gap-2.5">
              {isSuperAdmin && (
                <Link
                  href={
                    showDeleted
                      ? "/admin/therapists"
                      : "/admin/therapists?showDeleted=true"
                  }
                  data-testid="toggle-show-deleted-therapists"
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${
                    showDeleted
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {showDeleted ? "Hide Deleted" : "Show Deleted"}
                </Link>
              )}

              <Link href="/admin/therapists/new">
                <Button data-testid="add-therapist-button" size="sm" className="flex items-center gap-1.5">
                  <UserPlus className="h-4 w-4" />
                  <span>Register Therapist</span>
                </Button>
              </Link>
            </div>
          }
        />

        {/* Therapists Table: 6 Columns */}
        <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Registered Practitioners
              </h2>
              <p className="text-[11px] text-slate-500">
                {therapistList.length} practitioner{therapistList.length === 1 ? "" : "s"}
                {showDeleted && " (including deactivated accounts)"}
              </p>
            </div>
          </div>

          {therapistList.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No therapists found"
                description="No clinical therapists match the current filter."
                actionHref="/admin/therapists/new"
                actionLabel="Register Therapist"
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-xs border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px] select-none">
                  <tr>
                    <th className="px-5 py-3">Therapist</th>
                    <th className="px-5 py-3">Specialization</th>
                    <th className="px-5 py-3">Experience</th>
                    <th className="px-5 py-3">Caseload / Capacity</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {therapistList.map((th) => {
                    const isDeleted = th.deletedAt !== null;
                    const displayName = isDeleted ? `${th.name} (deleted)` : th.name;
                    const openCount = openCasesMap.get(th.id) ?? 0;
                    const isAtMax = openCount >= (th.maxOpenCases ?? 10);

                    return (
                      <tr
                        key={th.id}
                        className={`hover:bg-slate-50/60 transition-colors ${
                          isDeleted ? "bg-slate-50/40 text-slate-400" : ""
                        }`}
                      >
                        <td className="px-5 py-3.5">
                          <div
                            data-testid={`therapist-name-${th.id}`}
                            className={`font-semibold text-sm ${
                              isDeleted ? "line-through text-slate-400" : "text-slate-900"
                            }`}
                          >
                            {displayName}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {th.email}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-700">
                          <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium">
                            {th.specialization}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">
                          {th.experienceYears} yr{th.experienceYears === 1 ? "" : "s"}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">
                              {openCount} / {th.maxOpenCases}
                            </span>
                            {isAtMax && !isDeleted && (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
                                <AlertTriangle className="h-3 w-3" />
                                At Capacity
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {isDeleted ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              Deleted
                            </span>
                          ) : (
                            <StatusBadge
                              status={th.isActive ? "active" : "inactive"}
                            />
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <TherapistRowActions
                            therapist={th}
                            currentUserId={currentUser.id}
                            currentUserRole={currentUser.role}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
