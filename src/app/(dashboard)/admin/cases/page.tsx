import { requireRole } from "@/lib/session";
import { db } from "@/db";
import { cases, clients, users, branches, sessions, progressReports } from "@/db/schema";
import { eq, desc, and, or, ilike, asc, sql } from "drizzle-orm";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { CLINICAL_SERVICES, getServiceLabel } from "@/lib/services";
import { getTodayIST } from "@/lib/date-utils";
import { Search, Filter, Check, X as CrossIcon, FileText, ChevronRight } from "lucide-react";
import { CaseRowActions } from "./case-row-actions";
import { BranchReportButton } from "@/components/admin/branch-report-button";
import Link from "next/link";

interface CasesPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdminCasesPage({ searchParams }: CasesPageProps) {
  const currentUser = await requireRole("admin", "super_admin");

  const resolvedParams = await searchParams;
  const statusFilter = typeof resolvedParams.status === "string" ? resolvedParams.status : undefined;
  const serviceFilter = typeof resolvedParams.service === "string" ? resolvedParams.service : undefined;
  const therapistFilter = typeof resolvedParams.therapist === "string" ? resolvedParams.therapist : undefined;
  const branchFilter = typeof resolvedParams.branch === "string" ? resolvedParams.branch : undefined;
  const searchQuery = typeof resolvedParams.search === "string" ? resolvedParams.search : undefined;

  const todayIST = getTodayIST();

  // Fetch therapists and branches for filter dropdowns
  const allTherapists = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.role, "therapist"))
    .orderBy(asc(users.name));

  const allBranches = await db
    .select({ id: branches.id, name: branches.name })
    .from(branches)
    .orderBy(asc(branches.name));

  // Build filter conditions
  const conditions = [];

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

  if (branchFilter && branchFilter !== "all") {
    conditions.push(eq(cases.branchId, branchFilter));
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

  return (
    <DashboardShell user={currentUser} title="All Cases">
      <div className="space-y-6">
        {/* Page Header (No "New Case" button for Admin; includes Branch Patient Report download) */}
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

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Branch
              </label>
              <select
                name="branch"
                defaultValue={branchFilter || "all"}
                className="w-full rounded-none border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#0B7A63] focus:outline-none"
              >
                <option value="all">All Branches</option>
                {allBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
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
                {CLINICAL_SERVICES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
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

              <div className="self-end flex gap-1">
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  className="bg-[#0B7A63] hover:bg-[#096350] rounded-none px-3 text-xs"
                >
                  <Filter className="h-3.5 w-3.5" />
                </Button>
                {(statusFilter || serviceFilter || therapistFilter || branchFilter || searchQuery) && (
                  <Link href="/admin/cases">
                    <Button type="button" variant="secondary" size="sm" className="rounded-none text-xs">
                      Clear
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Cases Table */}
        <div className="rounded-none border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-slate-50/50">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                All Cases
              </h2>
              <p className="text-[11px] text-slate-500">
                {casesList.length} case{casesList.length === 1 ? "" : "s"} found
              </p>
            </div>
          </div>

          {casesList.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">
              No clinical cases match your filter criteria.
            </div>
          ) : (
            <div className="w-full">
              <table className="w-full block text-left text-xs divide-y divide-slate-100" data-testid="admin-cases-table">
                <thead className="sr-only">
                  <tr>
                    <th>Patient ID</th>
                    <th>Patient Name</th>
                    <th>Problem</th>
                    <th>Present Condition</th>
                    <th>Service</th>
                    <th>Status</th>
                    <th>Today</th>
                    <th>Therapist</th>
                    <th>Branch</th>
                    <th>Reports</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody className="block divide-y divide-slate-200 font-medium">
                  {casesList.map((cs) => {
                    const isClosed = cs.status === "completed";
                    const hasToday = todayDoneCaseIds.has(cs.id);
                    const serviceLabel = getServiceLabel(cs.service || cs.category);
                    const reportCount = reportCountMap.get(cs.id) || 0;

                    return (
                      <tr
                        key={cs.id}
                        data-testid={`admin-case-row-${cs.id}`}
                        className="block p-4 space-y-2 hover:bg-slate-50/70 transition-colors"
                      >
                        {/* 1. Header: Patient ID & Name */}
                        <td className="flex items-center justify-between font-mono font-bold text-[#0B7A63]">
                          <span>{cs.patientId || cs.caseNumber}</span>
                          <span className="font-sans font-semibold text-slate-900 text-sm">{cs.clientName}</span>
                        </td>

                        {/* 2. Service & Status */}
                        <td className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {serviceLabel}
                          </span>
                          {isClosed ? (
                            <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold bg-stone-100 text-stone-600 border border-stone-200">
                              Closed
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Active
                            </span>
                          )}
                        </td>

                        {/* 3. Problem */}
                        <td className="text-slate-700 text-xs line-clamp-2">
                          <span className="font-semibold text-slate-500 uppercase text-[10px] block">Problem</span>
                          {cs.problem || cs.description}
                        </td>

                        {/* 4. Therapist & Branch */}
                        <td className="flex items-center justify-between text-xs text-slate-600">
                          <span>Therapist: <strong>{cs.therapistName || "Unassigned"}</strong></span>
                          <span>{cs.branchName || "Main Branch"}</span>
                        </td>

                        {/* 5. Today session & Reports */}
                        <td className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                          <span className="flex items-center gap-1.5">
                            Today:
                            {hasToday ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 bg-emerald-100 text-emerald-800 font-semibold text-[10px]">Done</span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 bg-red-100 text-red-800 font-semibold text-[10px]">Pending</span>
                            )}
                          </span>
                          <span className="text-slate-500 font-mono">{reportCount} Report{reportCount === 1 ? "" : "s"}</span>
                        </td>

                        {/* 6. View Details Action */}
                        <td className="pt-2">
                          <Link
                            href={`/admin/cases/${cs.id}`}
                            data-testid={`view-case-link-${cs.id}`}
                            className="w-full min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider rounded-none transition-colors"
                          >
                            <span>Open Case Management</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
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
