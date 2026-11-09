import { requireRole } from "@/lib/session";
import { db } from "@/db";
import { cases, clients, users, branches, sessions, progressReports, userBranches } from "@/db/schema";
import { eq, desc, and, or, ilike, asc, sql, inArray, isNull } from "drizzle-orm";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { getFilterableServices } from "@/lib/services";
import { getTodayIST } from "@/lib/date-utils";
import { Search, ChevronRight } from "lucide-react";
import { CaseRowActions } from "./case-row-actions";
import { BranchReportButton } from "@/components/admin/branch-report-button";
import { BranchPickerCard } from "@/components/layout/branch-picker-card";
import { getScope } from "@/lib/scope";
import Link from "next/link";

interface CasesPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdminCasesPage({ searchParams }: CasesPageProps) {
  const currentUser = await requireRole("admin", "super_admin");
  const isSuperAdmin = currentUser.role === "super_admin";

  const resolvedParams = await searchParams;
  const statusFilter = typeof resolvedParams.status === "string" ? resolvedParams.status : undefined;
  const serviceFilter = typeof resolvedParams.service === "string" ? resolvedParams.service : undefined;
  const therapistFilter = typeof resolvedParams.therapist === "string" ? resolvedParams.therapist : undefined;
  const rawBranchFilter = typeof resolvedParams.branch === "string" ? resolvedParams.branch : undefined;
  const searchQuery = typeof resolvedParams.search === "string" ? resolvedParams.search : undefined;

  // Enforce server-side branch scoping:
  // If currentUser is Admin and supplies ?branch=..., getScope validates against allowed branches.
  // Tampering with an unauthorized branch ID triggers notFound() (404).
  const scope = await getScope(currentUser, rawBranchFilter);

  // If Admin has no assigned active branches, show empty / no branch message
  if (currentUser.role === "admin" && scope.allowedBranches.length === 0) {
    return (
      <DashboardShell user={currentUser} title="Cases">
        <div
          data-testid="no-branch-message"
          className="border border-amber-300 bg-amber-50 p-6 text-amber-900 rounded-none shadow-xs"
        >
          <h2 className="text-base font-semibold text-amber-950 mb-1">
            No Active Branch
          </h2>
          <p className="text-sm">
            Your account is not linked to an active branch. Contact your Super Admin.
          </p>
        </div>
      </DashboardShell>
    );
  }

  // Super Admin: Cases still picks a branch first if none is selected
  if (scope.isSuperAdmin && !scope.hasSelectedBranch) {
    return (
      <DashboardShell user={currentUser} title="Cases">
        <BranchPickerCard branches={scope.allowedBranches} />
      </DashboardShell>
    );
  }

  const todayIST = getTodayIST();

  // Fetch therapists for filter dropdown (scoped to Admin's branches for Admin)
  const allTherapists = currentUser.role === "admin"
    ? await db
        .select({ id: users.id, name: users.name })
        .from(userBranches)
        .innerJoin(users, eq(users.id, userBranches.userId))
        .where(
          and(
            inArray(userBranches.branchId, scope.allowedBranchIds),
            isNull(userBranches.removedAt),
            eq(users.role, "therapist"),
            isNull(users.deletedAt)
          )
        )
        .orderBy(asc(users.name))
    : await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(and(eq(users.role, "therapist"), isNull(users.deletedAt)))
        .orderBy(asc(users.name));

  const allBranches = await db
    .select({ id: branches.id, name: branches.name })
    .from(branches)
    .where(eq(branches.isActive, true))
    .orderBy(asc(branches.name));

  // Check if legacy physiotherapy cases exist in the scoped branch(es)
  const physioConditions = [or(eq(cases.service, "physiotherapy"), eq(cases.category, "physiotherapy"))];
  if (currentUser.role === "admin") {
    physioConditions.push(inArray(cases.branchId, scope.allowedBranchIds));
  } else if (scope.activeBranchId) {
    physioConditions.push(eq(cases.branchId, scope.activeBranchId));
  }
  const [hasPhysioRow] = await db
    .select({ id: cases.id })
    .from(cases)
    .where(and(...physioConditions))
    .limit(1);

  const availableServices = getFilterableServices(hasPhysioRow ? ["physiotherapy"] : []);

  // Build filter conditions
  const conditions = [];

  // Branch condition: strictly enforce admin branch scoping server-side
  if (currentUser.role === "admin") {
    if (rawBranchFilter && scope.allowedBranchIds.includes(rawBranchFilter)) {
      conditions.push(eq(cases.branchId, rawBranchFilter));
    } else if (scope.allowedBranchIds.length === 1) {
      conditions.push(eq(cases.branchId, scope.allowedBranchIds[0]));
    } else {
      conditions.push(inArray(cases.branchId, scope.allowedBranchIds));
    }
  } else {
    // Super Admin: uses active branch from picker
    if (scope.activeBranchId) {
      conditions.push(eq(cases.branchId, scope.activeBranchId));
    } else if (rawBranchFilter && rawBranchFilter !== "all") {
      conditions.push(eq(cases.branchId, rawBranchFilter));
    }
  }

  if (statusFilter && statusFilter !== "all") {
    if (statusFilter === "active") {
      conditions.push(or(eq(cases.status, "active"), eq(cases.status, "in_progress"), eq(cases.status, "assigned"), eq(cases.status, "accepted")));
    } else if (statusFilter === "closed") {
      conditions.push(eq(cases.status, "completed"));
    } else {
      conditions.push(eq(cases.status, statusFilter as any));
    }
  }

  if (serviceFilter && serviceFilter !== "all") {
    conditions.push(or(eq(cases.service, serviceFilter), eq(cases.category, serviceFilter)));
  }

  if (therapistFilter && therapistFilter !== "all") {
    conditions.push(eq(cases.currentTherapistId, therapistFilter));
  }

  if (searchQuery && searchQuery.trim() !== "") {
    const term = `%${searchQuery.trim()}%`;
    conditions.push(
      or(
        ilike(cases.caseNumber, term),
        ilike(cases.patientId, term),
        ilike(clients.fullName, term),
        ilike(cases.problem, term),
        ilike(cases.description, term)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Query all cases with client, therapist, and branch
  const casesList = await db
    .select({
      id: cases.id,
      caseNumber: cases.caseNumber,
      patientId: cases.patientId,
      problem: cases.problem,
      description: cases.description,
      presentCondition: cases.presentCondition,
      service: cases.service,
      category: cases.category,
      status: cases.status,
      currentTherapistId: cases.currentTherapistId,
      createdAt: cases.createdAt,
      clientName: clients.fullName,
      therapistName: users.name,
      branchName: branches.name,
    })
    .from(cases)
    .innerJoin(clients, eq(cases.clientId, clients.id))
    .leftJoin(users, eq(cases.currentTherapistId, users.id))
    .leftJoin(branches, eq(cases.branchId, branches.id))
    .where(whereClause)
    .orderBy(desc(cases.createdAt));

  // Fetch today's held sessions to display today's session icon
  const todaySessions = await db
    .select({ caseId: sessions.caseId })
    .from(sessions)
    .where(and(eq(sessions.sessionDate, todayIST), eq(sessions.status, "held")));

  const todayDoneCaseIds = new Set(todaySessions.map((s) => s.caseId));

  // Fetch submitted progress reports count per case
  const reportCounts = await db
    .select({
      caseId: progressReports.caseId,
      count: sql<number>`count(${progressReports.id})::int`,
    })
    .from(progressReports)
    .where(eq(progressReports.status, "submitted"))
    .groupBy(progressReports.caseId);

  const reportCountMap = new Map(reportCounts.map((r) => [r.caseId, r.count]));

  // Branch label string for Admin
  const adminBranchDisplay = scope.allowedBranches.map((b) => b.name).join(", ") || "No assigned branch";

  return (
    <DashboardShell user={currentUser} title="All Cases">
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title="Cases"
          description="View-only access to clinical cases, therapist assignments, and treatment records."
          action={<BranchReportButton />}
          breadcrumbs={[
            {
              label: "Dashboard",
              href: currentUser.role === "super_admin" ? "/super-admin/dashboard" : "/admin/dashboard",
            },
            { label: "Cases" },
          ]}
        />

        {/* Filter Toolbar */}
        <div className="rounded-none border border-slate-200 bg-white p-4 shadow-xs">
          <form method="GET" className="grid grid-cols-1 gap-3 sm:grid-cols-5 items-end">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  name="search"
                  defaultValue={searchQuery || ""}
                  placeholder="ID, name, or problem..."
                  className="w-full rounded-none border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0B7A63] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Therapist
              </label>
              <select
                name="therapist"
                defaultValue={therapistFilter || "all"}
                className="w-full rounded-none border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#0B7A63] focus:outline-none"
              >
                <option value="all">All Therapists</option>
                {allTherapists.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Branch Filter: Super Admin has dropdown; Admin has static label showing their branch only */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Branch
              </label>
              {isSuperAdmin ? (
                <select
                  name="branch"
                  defaultValue={rawBranchFilter || scope.activeBranchId || "all"}
                  className="w-full rounded-none border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#0B7A63] focus:outline-none"
                >
                  <option value="all">All Branches</option>
                  {allBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div
                  data-testid="admin-branch-label"
                  className="w-full rounded-none border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-900 truncate"
                  title={adminBranchDisplay}
                >
                  {adminBranchDisplay}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Service
              </label>
              <select
                name="service"
                defaultValue={serviceFilter || "all"}
                className="w-full rounded-none border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#0B7A63] focus:outline-none"
              >
                <option value="all">All Services</option>
                {availableServices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Status
              </label>
              <select
                name="status"
                defaultValue={statusFilter || "all"}
                className="w-full rounded-none border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#0B7A63] focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 sm:flex sm:items-center sm:col-span-5">
              <Button
                type="submit"
                size="sm"
                variant="primary"
                className="w-full sm:w-auto bg-[#0B7A63] hover:bg-[#096350] rounded-none px-4 min-h-[44px] text-xs font-semibold uppercase tracking-wider"
              >
                Filter
              </Button>
              <Link href="/admin/cases" className="w-full sm:w-auto block">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full sm:w-auto border-slate-300 text-slate-700 hover:bg-slate-50 rounded-none px-4 min-h-[44px] text-xs font-semibold uppercase tracking-wider"
                  title="Reset filters"
                >
                  Reset
                </Button>
              </Link>
            </div>
          </form>
        </div>

        {/* Cases Table */}
        <div className="rounded-none border border-slate-200 bg-white shadow-xs overflow-hidden">
          {casesList.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <p className="text-sm font-medium">No cases found matching your criteria.</p>
              <p className="text-xs text-slate-400 mt-1">Try resetting the filters or modifying your search.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 uppercase font-semibold">
                    <th className="py-3 px-4">Case # / Patient ID</th>
                    <th className="py-3 px-4">Patient Name</th>
                    <th className="py-3 px-4">Clinical Service</th>
                    <th className="py-3 px-4">Problem / Condition</th>
                    <th className="py-3 px-4">Assigned Practitioner</th>
                    <th className="py-3 px-4">Branch</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Reports</th>
                    <th className="py-3 px-4 text-center">Today</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {casesList.map((c) => {
                    const isTodayDone = todayDoneCaseIds.has(c.id);
                    const isPhysio = c.service === "physiotherapy" || c.category === "physiotherapy";
                    const isSpeech = c.service === "speech_therapy" || c.category === "speech_therapy";
                    const isSwallow = c.service === "swallow_therapy" || c.category === "swallow_therapy";
                    const isVitalStim = c.service === "vitalstim_therapy" || c.category === "vitalstim_therapy";
                    const reportCount = reportCountMap.get(c.id) || 0;

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-slate-900">
                          <div>{c.caseNumber}</div>
                          {c.patientId && (
                            <div className="text-[10px] text-slate-400 font-normal">
                              ID: {c.patientId}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {c.clientName}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 text-[11px] font-semibold border ${
                              isSpeech
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : isPhysio
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : isSwallow
                                ? "bg-blue-50 text-blue-800 border-blue-200"
                                : isVitalStim
                                ? "bg-purple-50 text-purple-800 border-purple-200"
                                : "bg-slate-50 text-slate-700 border-slate-200"
                            }`}
                          >
                            {c.service ? (isPhysio ? "Physiotherapy (past)" : isSpeech ? "Speech Therapy" : isSwallow ? "Swallow Therapy" : isVitalStim ? "VitalStim Therapy" : c.service) : "—"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={c.problem || c.presentCondition || ""}>
                          {c.problem || c.presentCondition || "—"}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {c.therapistName || <span className="text-slate-400 italic">Unassigned</span>}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {c.branchName || "—"}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 text-[11px] font-semibold border ${
                              c.status === "active" || c.status === "in_progress" || c.status === "assigned" || c.status === "accepted"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                          >
                            {c.status === "active" || c.status === "in_progress" || c.status === "assigned" || c.status === "accepted"
                              ? "Active"
                              : "Closed"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {reportCount > 0 ? (
                            <Link
                              href={`/admin/cases/${c.id}?tab=reports`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-[#0B7A63] border border-emerald-200 hover:bg-emerald-100 transition-colors"
                              title={`${reportCount} Progress ${reportCount === 1 ? "Report" : "Reports"} Submitted`}
                            >
                              <span>{reportCount}</span>
                            </Link>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isTodayDone ? (
                            <span
                              className="inline-flex items-center justify-center h-6 w-6 rounded-none bg-emerald-100 text-[#0B7A63] border border-emerald-300"
                              title="Session recorded today"
                            >
                              ✓
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center justify-center h-6 w-6 rounded-none bg-slate-50 text-slate-400 border border-slate-200"
                              title="No session recorded yet today"
                            >
                              ✕
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <CaseRowActions caseId={c.id} isAssigned={Boolean(c.currentTherapistId)} />
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
