import { notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { EditAdminForm } from "./edit-admin-form";
import { ArrowLeft } from "lucide-react";

interface AdminDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminDetailPage({ params }: AdminDetailPageProps) {
  const currentUser = await requireRole("super_admin");
  const { id } = await params;

  const [admin] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!admin) {
    notFound();
  }

  return (
    <DashboardShell user={currentUser} title={`Edit Admin: ${admin.name}`}>
      <div className="space-y-6">
        <div>
          <Link
            href="/super-admin/admins"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Administrators</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Edit Administrator Profile
          </h1>
          <p className="text-sm text-slate-500">
            Manage profile settings and account status for {admin.name} ({admin.email}).
          </p>
        </div>

        <EditAdminForm admin={admin} />
      </div>
    </DashboardShell>
  );
}
