import { requireRole } from "@/lib/session";
import { db } from "@/db";
import { users, therapistProfiles, cases } from "@/db/schema";
import { eq, isNull, and, or, sql } from "drizzle-orm";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TherapistRowActions } from "./therapist-row-actions";
import { Plus, AlertCircle } from "lucide-react";
import Link from "next/link";

interface TherapistsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function TherapistsPage({
  searchParams,
}: TherapistsPageProps) {
  const currentUser = await requireRole("admin", "super_admin");
  const isSuperAdmin = currentUser.role === "super_admin";

  const resolvedParams = await searchParams;
  const showDeleted = isSuperAdmin && resolvedParams.showDeleted === "true";

  // Build the query condition based on role and showDeleted toggle
  let whereCondition;
  if (showDeleted) {
    whereCondition = eq(users.role, "therapist");
  } else {
    whereCondition = and(
      eq(users.role, "therapist"),
      isNull(users.deletedAt)
    );
  }

  // Fetch therapists with profiles
  const therapistList = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      isActive: users.isActive,
      deletedAt: users.deletedAt,
      specialization: therapistProfiles.specialization,
      experienceYears: therapistProfiles.experienceYears,
      maxOpenCases: therapistProfiles.maxOpenCases,
    })
    .from(users)
    .innerJoin(therapistProfiles, eq(users.id, therapistProfiles.userId))
    .where(whereCondition)
    .orderBy(users.name);

  // Count active cases for each therapist
  const activeCasesCounts = await db
    .select({
      therapistId: cases.currentTherapistId,
      count: sql<number>`count(*)::int`,
    })
    .from(cases)
    .where(
      and(
        sql`${cases.currentTherapistId} IS NOT NULL`,
        or(
          eq(cases.status, "assigned"),
          eq(cases.status, "accepted"),
          eq(cases.status, "in_progress")
        )
      )
    )
    .groupBy(cases.currentTherapistId);

  const openCasesMap = new Map<string, number>();
  activeCasesCounts.forEach((c) => {
    if (c.therapistId) {
      openCasesMap.set(c.therapistId, c.count);
    }
  });

  return (
    <DashboardShell user={currentUser} title="Therapist Management">
      <div className="space-y-6">
        <PageHeader
          title="Therapist Management"
          description="Manage clinical practitioners, specializations, credentials, and daily room allocations."
          breadcrumbs={[
            {
              label: "Dashboard",
              href: isSuperAdmin ? "/super-admin/dashboard" : "/admin/dashboard",
            },
            { label: "Therapists" },
          ]}
          action={
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {isSuperAdmin && (
                <Link
                  href={
                    showDeleted
                      ? "/admin/therapists"
                      : "/admin/therapists?showDeleted=true"
                  }
                  data-testid="toggle-show-deleted-therapists"
                >
                  <Button
                    variant={showDeleted ? "primary" : "secondary"}
                    size="sm"
                  >
                    {showDeleted ? "Hide Deleted" : "Show Deleted"}
                  </Button>
                </Link>
              )}

              <Link href="/admin/therapists/new" className="w-full sm:w-auto">
                <Button
                  data-testid="add-therapist-button"
                  size="sm"
                  variant="primary"
                  leadingIcon={<Plus className="h-4 w-4" />}
                  className="w-full sm:w-auto"
                >
                  Register Therapist
                </Button>
              </Link>
            </div>
          }
        />

        {/* Therapists Table: 6 Columns */}
        <div className="rounded-none border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-slate-50/50">
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
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px] select-none z-10">
                  <tr>
                    <th className="px-5 py-3 min-w-[200px]">Therapist</th>
                    <th className="px-5 py-3 min-w-[240px]">Specialization</th>
                    <th className="px-5 py-3 min-w-[100px]">Experience</th>
                    <th className="px-5 py-3 min-w-[180px]">Caseload / Capacity</th>
                    <th className="px-5 py-3 min-w-[120px]">Status</th>
                    <th className="px-5 py-3 text-right w-[220px] min-w-[220px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {therapistList.map((th) => {
                    const isDeleted = th.deletedAt !== null;
                    const displayName = isDeleted ? `${th.name} (deleted)` : th.name;
                    const openCount = openCasesMap.get(th.id) ?? 0;
                    const maxCap = th.maxOpenCases ?? 10;
                    const isAtCapacity = openCount === maxCap;
                    const isOverCapacity = openCount > maxCap;
                    const percent = Math.min(Math.round((openCount / maxCap) * 100), 100);

                    return (
                      <tr
                        key={th.id}
                        className={`hover:bg-slate-50/60 transition-colors ${
                          isDeleted ? "bg-slate-50/40 text-slate-400" : ""
                        }`}
                      >
                        {/* 1. Therapist Name & Email */}
                        <td className="px-5 py-3.5 min-w-[200px]">
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

                        {/* 2. Specialization (min-width 240px with line-clamp-2) */}
                        <td className="px-5 py-3.5 min-w-[240px] max-w-[300px]">
                          <span
                            className="inline-block text-slate-800 text-[11px] font-medium leading-relaxed"
                            title={th.specialization}
                          >
                            {th.specialization}
                          </span>
                        </td>

                        {/* 3. Experience */}
                        <td className="px-5 py-3.5 min-w-[100px] text-slate-600 whitespace-nowrap">
                          {th.experienceYears} yr{th.experienceYears === 1 ? "" : "s"}
                        </td>

                        {/* 4. Caseload / Capacity (Never Wrap) */}
                        <td className="px-5 py-3.5 min-w-[180px] whitespace-nowrap">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono tabular-nums font-semibold text-xs text-slate-800">
                                {openCount} / {maxCap}
                              </span>
                              {isOverCapacity && !isDeleted && (
                                <span className="inline-flex items-center gap-1 rounded-none bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200 uppercase tracking-wide">
                                  <AlertCircle className="h-3 w-3" />
                                  Over capacity
                                </span>
                              )}
                              {isAtCapacity && !isDeleted && (
                                <span className="inline-flex items-center gap-1 rounded-none bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200 uppercase tracking-wide">
                                  <AlertCircle className="h-3 w-3" />
                                  At capacity
                                </span>
                              )}
                            </div>
                            {/* Visual Progress Bar */}
                            <div className="h-1.5 w-full bg-slate-100 rounded-none overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 rounded-none ${
                                  isOverCapacity
                                    ? "bg-rose-600"
                                    : isAtCapacity
                                    ? "bg-amber-500"
                                    : "bg-teal-600"
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* 5. Status Badge */}
                        <td className="px-5 py-3.5 min-w-[120px] whitespace-nowrap">
                          {isDeleted ? (
                            <span className="inline-flex items-center h-[24px] px-2 text-[12px] uppercase font-semibold tracking-wider rounded-none bg-slate-100 text-slate-600 border border-slate-200">
                              Deleted
                            </span>
                          ) : (
                            <StatusBadge
                              status={th.isActive ? "active" : "inactive"}
                            />
                          )}
                        </td>

                        {/* 6. Row Actions (Fixed 220px, Right-aligned) */}
                        <td className="px-5 py-3.5 text-right w-[220px] min-w-[220px] whitespace-nowrap">
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
