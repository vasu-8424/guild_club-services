import { requireRole } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/db";
import { cases, clients } from "@/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { TherapistCasesClient } from "./therapist-cases-client";

export default async function TherapistCasesPage() {
  const user = await requireRole("therapist");

  // 1. Fetch pending invitations (status = 'assigned')
  const pendingCases = await db
    .select({
      id: cases.id,
      caseNumber: cases.caseNumber,
      category: cases.category,
      priority: cases.priority,
      status: cases.status,
      createdAt: cases.createdAt,
      clientName: clients.fullName,
      clientPhone: clients.phone,
    })
    .from(cases)
    .innerJoin(clients, eq(cases.clientId, clients.id))
    .where(
      and(
        eq(cases.currentTherapistId, user.id),
        eq(cases.status, "assigned")
      )
    )
    .orderBy(desc(cases.createdAt));

  // 2. Fetch active cases (status IN ('accepted', 'in_progress', 'on_hold', 'completed'))
  const activeCases = await db
    .select({
      id: cases.id,
      caseNumber: cases.caseNumber,
      category: cases.category,
      priority: cases.priority,
      status: cases.status,
      createdAt: cases.createdAt,
      clientName: clients.fullName,
      clientPhone: clients.phone,
    })
    .from(cases)
    .innerJoin(clients, eq(cases.clientId, clients.id))
    .where(
      and(
        eq(cases.currentTherapistId, user.id),
        inArray(cases.status, ["accepted", "in_progress", "on_hold", "completed"])
      )
    )
    .orderBy(desc(cases.createdAt));

  return (
    <DashboardShell user={user} title="My Cases">
      <div className="space-y-6">
        <PageHeader
          title="My Cases"
          description="View and manage your active clinical cases, treatment notes, and new case invitations."
          breadcrumbs={[
            { label: "Dashboard", href: "/therapist/dashboard" },
            { label: "My Cases" },
          ]}
        />

        <TherapistCasesClient
          pendingCases={pendingCases}
          activeCases={activeCases}
        />
      </div>
    </DashboardShell>
  );
}
