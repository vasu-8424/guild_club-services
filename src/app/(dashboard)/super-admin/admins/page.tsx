import Link from "next/link";
import { eq, and, isNull, desc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { UserPlus } from "lucide-react";
import { AdminRowActions } from "./admin-row-actions";

interface SuperAdminAdminsPageProps {
  searchParams: Promise<{ showDeleted?: string }>;
}

export default async function SuperAdminAdminsPage({
  searchParams,
}: SuperAdminAdminsPageProps) {
  const currentUser = await requireRole("super_admin");
  const params = await searchParams;
  const showDeleted = params.showDeleted === "true";

  const condition = showDeleted
    ? eq(users.role, "admin")
    : and(eq(users.role, "admin"), isNull(users.deletedAt));

  const adminList = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      isActive: users.isActive,
      deletedAt: users.deletedAt,
      mustChangePassword: users.mustChangePassword,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(condition)
    .orderBy(desc(users.createdAt));

  return (
    <DashboardShell user={currentUser} title="Administrators">
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title="Administrators"
          description="Manage clinical administrator staff with permissions to triage cases and manage therapists."
          breadcrumbs={[
            { label: "Dashboard", href: "/super-admin/dashboard" },
            { label: "Administrators" },
          ]}
          action={
            <div className="flex items-center gap-2.5">
              <Link
                href={
                  showDeleted
                    ? "/super-admin/admins"
                    : "/super-admin/admins?showDeleted=true"
                }
                data-testid="toggle-show-deleted-link"
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${
                  showDeleted
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {showDeleted ? "Hide Deleted" : "Show Deleted"}
              </Link>

              <Link href="/super-admin/admins/new">
                <Button data-testid="add-admin-button" size="sm" className="flex items-center gap-1.5">
                  <UserPlus className="h-4 w-4" />
                  <span>Add Admin</span>
                </Button>
              </Link>
            </div>
          }
        />

        {/* Admins Table */}
        <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
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
                <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-xs border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px] select-none">
                  <tr>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Phone</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Created</th>
                    <th className="px-5 py-3 text-right">Actions</th>
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
                        <td className="px-5 py-3.5 font-medium text-slate-900">
                          <span
                            data-testid={`admin-name-${adm.id}`}
                            className={isDeleted ? "line-through text-slate-400" : ""}
                          >
                            {displayName}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 font-mono text-xs">
                          {adm.email}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 text-xs">
                          {adm.phone || "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          {isDeleted ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              Deleted
                            </span>
                          ) : (
                            <StatusBadge
                              status={adm.isActive ? "active" : "inactive"}
                            />
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500">
                          {new Date(adm.createdAt).toLocaleDateString("en-IN", {
                            timeZone: "Asia/Kolkata",
                          })}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <AdminRowActions
                            admin={adm}
                            currentUserId={currentUser.id}
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
