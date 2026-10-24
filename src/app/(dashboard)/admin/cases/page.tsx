import Link from "next/link";
import { eq, desc, and, or, ilike } from "drizzle-orm";
import { db } from "@/db";
import { cases, clients, users, type CasePriority, type CaseStatus } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Plus, Search, Eye, Filter, MoreHorizontal, ArrowRight } from "lucide-react";
import { formatUserName } from "@/lib/format-user";

interface CasesPageProps {
  searchParams: Promise<{
    status?: string;
    priority?: string;
    search?: string;
  }>;
}

export default async function AdminCasesPage({ searchParams }: CasesPageProps) {
  const currentUser = await requireRole("admin", "super_admin");
  const params = await searchParams;

  const statusFilter = params.status && params.status !== "all" ? params.status : undefined;
  const priorityFilter = params.priority && params.priority !== "all" ? params.priority : undefined;
  const searchQuery = params.search?.trim();

  // Build conditions
  const conditions = [];

  if (statusFilter) {
    conditions.push(eq(cases.status, statusFilter as CaseStatus));
  }

  if (priorityFilter) {
    conditions.push(eq(cases.priority, priorityFilter as CasePriority));
  }

  if (searchQuery) {
    conditions.push(
      or(
        ilike(cases.caseNumber, `%${searchQuery}%`),
        ilike(clients.fullName, `%${searchQuery}%`),
        ilike(clients.phone, `%${searchQuery}%`)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Query cases joined with clients and assigned therapists
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
            <Link href="/admin/cases/new">
              <Button size="sm" className="flex items-center gap-1.5">
                <Plus className="h-4 w-4" />
                <span>+ New case</span>
              </Button>
            </Link>
          }
        />

        {/* Search & Filter Toolbar */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <form method="GET" className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  name="search"
                  defaultValue={searchQuery || ""}
                  placeholder="Case # or client name..."
                  className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 shadow-2xs hover:border-slate-300 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Status
              </label>
              <select
                name="status"
                defaultValue={statusFilter || "all"}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-2xs hover:border-slate-300 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
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
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Priority
              </label>
              <select
                name="priority"
                defaultValue={priorityFilter || "all"}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-2xs hover:border-slate-300 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              >
                <option value="all">All priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div className="flex gap-2">
              <Button type="submit" size="sm" className="w-full flex items-center justify-center gap-1.5 h-8">
                <Filter className="h-3.5 w-3.5" />
                <span>Filter</span>
              </Button>
              {(statusFilter || priorityFilter || searchQuery) && (
                <Link href="/admin/cases">
                  <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-xs">
                    Clear
                  </Button>
                </Link>
              )}
            </div>
          </form>
        </div>

        {/* Cases Table: Max 6 Columns */}
        <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Case Records
              </h2>
              <p className="text-[11px] text-slate-500">
                {casesList.length} matching case record{casesList.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          {casesList.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No cases found"
                description="No cases match your filter criteria or have been created yet."
                actionHref="/admin/cases/new"
                actionLabel="Create new case"
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-xs border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px] select-none">
                  <tr>
                    <th className="px-5 py-3">Case</th>
                    <th className="px-5 py-3">Client</th>
                    <th className="px-5 py-3">Category & Priority</th>
                    <th className="px-5 py-3">Assigned Therapist</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {casesList.map((cs) => (
                    <tr
                      key={cs.id}
                      className="hover:bg-slate-50/60 transition-colors duration-150"
                    >
                      {/* 1. Case Number */}
                      <td className="px-5 py-3.5 font-mono font-medium text-teal-800">
                        {cs.caseNumber}
                      </td>

                      {/* 2. Client */}
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-slate-900">
                          {cs.clientName}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {cs.clientPhone}
                        </div>
                      </td>

                      {/* 3. Category & Priority */}
                      <td className="px-5 py-3.5">
                        <div className="text-slate-800 font-medium truncate max-w-[180px]">
                          {cs.category}
                        </div>
                        <div className="mt-0.5">
                          <PriorityBadge priority={cs.priority} />
                        </div>
                      </td>

                      {/* 4. Assigned Therapist */}
                      <td className="px-5 py-3.5 text-slate-700">
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
                      <td className="px-5 py-3.5">
                        <StatusBadge status={cs.status} />
                      </td>

                      {/* 6. Action */}
                      <td className="px-5 py-3.5 text-right">
                        <Link href={`/admin/cases/${cs.id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs border-slate-200 hover:border-teal-500 hover:text-teal-700 text-slate-700"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            <span>Manage</span>
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
