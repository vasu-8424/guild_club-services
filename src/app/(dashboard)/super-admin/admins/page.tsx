import { requireRole } from "@/lib/session";
import { db } from "@/db";
import { users, branches, userBranches } from "@/db/schema";
import { eq, isNull, and, asc } from "drizzle-orm";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminRowActions } from "./admin-row-actions";
import { Plus } from "lucide-react";
import Link from "next/link";

interface AdminsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdminsPage({ searchParams }: AdminsPageProps) {
  const currentUser = await requireRole("super_admin");

  // Enforce super_admin only access at page level (also enforced in proxy)
  if (currentUser.role !== "super_admin") {
    return (
      <DashboardShell user={currentUser} title="Administrator Management">
        <div className="p-8 text-center">
          <p className="text-rose-600 font-semibold">
            Access Restricted: Only Super Admins can manage administrators.
          </p>
        </div>
      </DashboardShell>
    );
  }

  const resolvedParams = await searchParams;
  const showDeleted = resolvedParams.showDeleted === "true";

  // Build the query condition based on showDeleted toggle
  let whereCondition;
  if (showDeleted) {
    whereCondition = eq(users.role, "admin");
  } else {
    whereCondition = and(
      eq(users.role, "admin"),
      isNull(users.deletedAt)
    );
  }

  // Fetch admin accounts
  const adminList = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      isActive: users.isActive,
      deletedAt: users.deletedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(whereCondition)
    .orderBy(users.name);

  // Fetch active branches for editing access
  const activeBranches = await db
    .select({
      id: branches.id,
      name: branches.name,
      isActive: branches.isActive,
    })
    .from(branches)
    .where(eq(branches.isActive, true))
    .orderBy(asc(branches.name));

  // Fetch active branch assignments
  const allUserBranches = await db
    .select({
      userId: userBranches.userId,
      branchId: userBranches.branchId,
    })
    .from(userBranches)
    .where(isNull(userBranches.removedAt));

  const adminBranchesMap = new Map<string, string[]>();
  for (const ub of allUserBranches) {
    const list = adminBranchesMap.get(ub.userId) || [];
    list.push(ub.branchId);
    adminBranchesMap.set(ub.userId, list);
  }

  return (
    <DashboardShell user={currentUser} title="Administrator Management">
      <div className="space-y-6">
        <PageHeader
          title="Administrator Management"
          description="Create, monitor, and manage clinical admin accounts, privileges, and credentials."
          breadcrumbs={[
            { label: "Dashboard", href: "/super-admin/dashboard" },
            { label: "Admins" },
          ]}
          action={
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <Link
                href={
                  showDeleted
                    ? "/super-admin/admins"
                    : "/super-admin/admins?showDeleted=true"
                }
                data-testid="toggle-show-deleted-admins"
              >
                <Button
                  variant={showDeleted ? "primary" : "secondary"}
                  size="sm"
                >
                  {showDeleted ? "Hide Deleted" : "Show Deleted"}
                </Button>
              </Link>

              <Link href="/super-admin/admins/new" className="w-full sm:w-auto">
                <Button
                  data-testid="add-admin-button"
                  size="sm"
                  variant="primary"
                  leadingIcon={<Plus className="h-4 w-4" />}
                  className="w-full sm:w-auto"
                >
                  Add Admin
                </Button>
              </Link>
            </div>
          }
        />

        {/* Admins Table */}
        <div className="rounded-none border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-slate-50/50">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Registered Administrators
              </h2>
              <p className="text-[11px] text-slate-500">
                {adminList.length} administrator{adminList.length === 1 ? "" : "s"}
                {showDeleted && " (including deactivated accounts)"}
              </p>
            </div>
          </div>

          {adminList.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No administrators found"
                description="No clinical administrators match the current filter."
                actionHref="/super-admin/admins/new"
                actionLabel="Add Admin"
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px] select-none z-10">
                  <tr>
                    <th className="px-5 py-3 min-w-[200px]">Name</th>
                    <th className="px-5 py-3 min-w-[200px]">Email</th>
                    <th className="px-5 py-3 min-w-[140px]">Phone</th>
                    <th className="px-5 py-3 min-w-[120px]">Status</th>
                    <th className="px-5 py-3 min-w-[120px]">Created</th>
                    <th className="px-5 py-3 text-right w-[220px] min-w-[220px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {adminList.map((adm) => {
                    const isDeleted = adm.deletedAt !== null;
                    const displayName = isDeleted ? `${adm.name} (deleted)` : adm.name;

                    return (
                      <tr
                        key={adm.id}
                        className={`hover:bg-slate-50/60 transition-colors ${
                          isDeleted ? "bg-slate-50/40 text-slate-400" : ""
                        }`}
                      >
                        <td className="px-5 py-3.5 min-w-[200px]">
                          <div
                            data-testid={`admin-name-${adm.id}`}
                            className={`font-semibold text-sm ${
                              isDeleted ? "line-through text-slate-400" : "text-slate-900"
                            }`}
                          >
                            {displayName}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 min-w-[200px] text-slate-600 font-mono">
                          {adm.email}
                        </td>
                        <td className="px-5 py-3.5 min-w-[140px] text-slate-600">
                          {adm.phone || "—"}
                        </td>
                        <td className="px-5 py-3.5 min-w-[120px] whitespace-nowrap">
                          {isDeleted ? (
                            <span className="inline-flex items-center h-[24px] px-2 text-[12px] uppercase font-semibold tracking-wider rounded-none bg-slate-100 text-slate-600 border border-slate-200">
                              Deleted
                            </span>
                          ) : (
                            <StatusBadge
                              status={adm.isActive ? "active" : "inactive"}
                            />
                          )}
                        </td>
                        <td className="px-5 py-3.5 min-w-[120px] text-slate-500 text-[11px] whitespace-nowrap font-mono">
                          {adm.createdAt ? new Date(adm.createdAt).toLocaleDateString("en-IN") : "—"}
                        </td>
                        <td className="px-5 py-3.5 text-right w-[220px] min-w-[220px] whitespace-nowrap">
                          <AdminRowActions
                            admin={adm}
                            currentUserId={currentUser.id}
                            branches={activeBranches}
                            assignedBranchIds={adminBranchesMap.get(adm.id) || []}
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
