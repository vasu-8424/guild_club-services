import { requireRole } from "@/lib/session";
import { db } from "@/db";
import { cases, clients, users } from "@/db/schema";
import { eq, desc, and, or, ilike } from "drizzle-orm";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatUserName } from "@/lib/format-user";
import { Plus, Search, Filter } from "lucide-react";
import { CaseRowActions } from "./case-row-actions";
import Link from "next/link";

interface CasesPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CasesPage({ searchParams }: CasesPageProps) {
  const currentUser = await requireRole("admin", "super_admin");

  const resolvedParams = await searchParams;
  const statusFilter = typeof resolvedParams.status === "string" ? resolvedParams.status : undefined;
  const priorityFilter = typeof resolvedParams.priority === "string" ? resolvedParams.priority : undefined;
  const searchQuery = typeof resolvedParams.search === "string" ? resolvedParams.search : undefined;

  // Build filter conditions
  const conditions = [];

  if (statusFilter && statusFilter !== "all") {
    conditions.push(eq(cases.status, statusFilter as any));
  }

  if (priorityFilter && priorityFilter !== "all") {
    conditions.push(eq(cases.priority, priorityFilter as any));
  }

  if (searchQuery && searchQuery.trim() !== "") {
    const term = `%${searchQuery.trim()}%`;
    conditions.push(
      or(
        ilike(cases.caseNumber, term),
        ilike(clients.fullName, term),
        ilike(clients.phone, term)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Query cases joined with clients and therapists
  const casesList = await db
    .select({
      id: cases.id,
      caseNumber: cases.caseNumber,
      category: cases.category,
      priority: cases.priority,
      status: cases.status,
      createdAt: cases.createdAt,
      clientName: clients.fullName,
      clientPhone: clients.phone,
      therapistName: users.name,
      therapistDeletedAt: users.deletedAt,
      therapistEmail: users.email,
    })
    .from(cases)
    .innerJoin(clients, eq(cases.clientId, clients.id))
    .leftJoin(users, eq(cases.currentTherapistId, users.id))
    .where(whereClause)
    .orderBy(desc(cases.createdAt));

  return (
    <DashboardShell user={currentUser} title="Cases">
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title="Cases"
          description="Manage client intake records, therapist assignments, and case outcomes."
          breadcrumbs={[
            { label: "Dashboard", href: currentUser.role === "super_admin" ? "/super-admin/dashboard" : "/admin/dashboard" },
            { label: "Cases" },
          ]}
          action={
            <Link href="/admin/cases/new" className="w-full sm:w-auto">
              <Button
                size="sm"
                variant="primary"
                leadingIcon={<Plus className="h-4 w-4" />}
                className="w-full sm:w-auto"
              >
                New Case
              </Button>
            </Link>
          }
        />

        {/* Filter Toolbar */}
        <div className="rounded-none border border-slate-200 bg-white p-4 shadow-xs">
          <form method="GET" className="grid grid-cols-1 gap-3 sm:grid-cols-4 items-end">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  name="search"
                  defaultValue={searchQuery || ""}
                  placeholder="Case # or client name..."
                  className="w-full rounded-none border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 shadow-2xs hover:border-slate-400 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Status
              </label>
              <select
                name="status"
                defaultValue={statusFilter || "all"}
                className="w-full rounded-none border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-2xs hover:border-slate-400 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              >
                <option value="all">All statuses</option>
                <option value="new">New</option>
                <option value="assigned">Assigned</option>
                <option value="accepted">Accepted</option>
                <option value="in_progress">In Progress</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Priority
              </label>
              <select
                name="priority"
                defaultValue={priorityFilter || "all"}
                className="w-full rounded-none border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-2xs hover:border-slate-400 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              >
                <option value="all">All priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                variant="primary"
                leadingIcon={<Filter className="h-4 w-4" />}
                className="w-full"
              >
                Filter
              </Button>
              {(statusFilter || priorityFilter || searchQuery) && (
                <Link href="/admin/cases">
                  <Button type="button" variant="secondary" size="sm">
                    Clear
                  </Button>
                </Link>
              )}
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
            <div className="p-8">
              <EmptyState
                title="No cases found"
                description={
                  statusFilter || priorityFilter || searchQuery
                    ? "No cases matched your filter criteria. Try resetting the filters."
                    : "No client cases have been registered in the system yet."
                }
                actionHref="/admin/cases/new"
                actionLabel="New Case"
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px] select-none z-10">
                  <tr>
                    <th className="px-5 py-3 min-w-[130px]">Case</th>
                    <th className="px-5 py-3 min-w-[160px]">Client</th>
                    <th className="px-5 py-3 min-w-[160px]">Category & Priority</th>
                    <th className="px-5 py-3 min-w-[170px]">Assigned Therapist</th>
                    <th className="px-5 py-3 min-w-[120px]">Status</th>
                    <th className="px-5 py-3 text-right w-[220px] min-w-[220px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {casesList.map((cs) => {
                    const isAssigned = Boolean(cs.therapistName);

                    return (
                      <tr
                        key={cs.id}
                        className="hover:bg-slate-50/60 transition-colors duration-150"
                      >
                        {/* 1. Case Number */}
                        <td className="px-5 py-3.5 font-mono font-medium text-teal-800 whitespace-nowrap">
                          {cs.caseNumber}
                        </td>

                        {/* 2. Client */}
                        <td className="px-5 py-3.5 min-w-[160px]">
                          <div className="font-semibold text-slate-900">
                            {cs.clientName}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {cs.clientPhone}
                          </div>
                        </td>

                        {/* 3. Category & Priority */}
                        <td className="px-5 py-3.5 min-w-[160px]">
                          <div className="text-slate-800 font-medium truncate max-w-[180px]">
                            {cs.category}
                          </div>
                          <div className="mt-1">
                            <PriorityBadge priority={cs.priority} />
                          </div>
                        </td>

                        {/* 4. Assigned Therapist */}
                        <td className="px-5 py-3.5 text-slate-700 min-w-[170px]">
                          {cs.therapistName ? (
                            <div className="font-medium text-slate-800">
                              {formatUserName(cs.therapistName, cs.therapistDeletedAt)}
                            </div>
                          ) : (
                            <span className="italic text-slate-400">
                              Unassigned
                            </span>
                          )}
                        </td>

                        {/* 5. Status */}
                        <td className="px-5 py-3.5 min-w-[120px] whitespace-nowrap">
                          <StatusBadge status={cs.status} />
                        </td>

                        {/* 6. Action (Fixed 220px, Right-aligned) */}
                        <td className="px-5 py-3.5 text-right w-[220px] min-w-[220px] whitespace-nowrap">
                          <CaseRowActions caseId={cs.id} isAssigned={isAssigned} />
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
