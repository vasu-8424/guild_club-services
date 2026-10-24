import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  cases,
  clients,
  users,
  caseNotes,
  sessions,
  caseEvents,
} from "@/db/schema";
import { requireRole } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { CaseStatusCard } from "@/app/(dashboard)/admin/cases/[id]/case-status-card";
import { CaseNotesCard } from "@/app/(dashboard)/admin/cases/[id]/case-notes-card";
import { CaseSessionsCard } from "@/app/(dashboard)/admin/cases/[id]/case-sessions-card";
import { CaseTimeline } from "@/app/(dashboard)/admin/cases/[id]/case-timeline";
import { ArrowLeft, User, Calendar } from "lucide-react";

interface TherapistCaseDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TherapistCaseDetailPage({
  params,
}: TherapistCaseDetailPageProps) {
  const currentUser = await requireRole("therapist");
  const { id } = await params;

  // Fetch case and client
  const [caseRecord] = await db
    .select({
      id: cases.id,
      caseNumber: cases.caseNumber,
      category: cases.category,
      priority: cases.priority,
      description: cases.description,
      status: cases.status,
      outcome: cases.outcome,
      createdAt: cases.createdAt,
      closedAt: cases.closedAt,
      currentTherapistId: cases.currentTherapistId,
      clientId: cases.clientId,
      clientName: clients.fullName,
      clientEmail: clients.email,
      clientPhone: clients.phone,
      clientAge: clients.age,
      clientGender: clients.gender,
    })
    .from(cases)
    .innerJoin(clients, eq(cases.clientId, clients.id))
    .where(eq(cases.id, id))
    .limit(1);

  if (!caseRecord) {
    notFound();
  }

  // Ensure this therapist is assigned to the case
  if (caseRecord.currentTherapistId !== currentUser.id) {
    redirect("/therapist/dashboard");
  }

  // Fetch notes
  const notesList = await db
    .select({
      id: caseNotes.id,
      note: caseNotes.note,
      createdAt: caseNotes.createdAt,
      authorName: users.name,
      authorRole: users.role,
    })
    .from(caseNotes)
    .innerJoin(users, eq(caseNotes.authorId, users.id))
    .where(eq(caseNotes.caseId, id))
    .orderBy(desc(caseNotes.createdAt));

  // Fetch sessions
  const sessionsList = await db
    .select({
      id: sessions.id,
      scheduledAt: sessions.scheduledAt,
      status: sessions.status,
      notes: sessions.notes,
      therapistName: users.name,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.therapistId, users.id))
    .where(eq(sessions.caseId, id))
    .orderBy(desc(sessions.scheduledAt));

  // Fetch audit events
  const eventsList = await db
    .select({
      id: caseEvents.id,
      eventType: caseEvents.eventType,
      actorRole: caseEvents.actorRole,
      actorName: users.name,
      fromStatus: caseEvents.fromStatus,
      toStatus: caseEvents.toStatus,
      metadata: caseEvents.metadata,
      occurredAt: caseEvents.occurredAt,
    })
    .from(caseEvents)
    .innerJoin(users, eq(caseEvents.actorId, users.id))
    .where(eq(caseEvents.caseId, id))
    .orderBy(desc(caseEvents.occurredAt));

  return (
    <DashboardShell user={currentUser} title={`Case ${caseRecord.caseNumber}`}>
      <div className="space-y-6">
        {/* Back Link & Header */}
        <div>
          <Link
            href="/therapist/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to My Dashboard</span>
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xl font-bold text-emerald-800">
                  {caseRecord.caseNumber}
                </span>
                <PriorityBadge priority={caseRecord.priority} />
                <StatusBadge status={caseRecord.status} />
              </div>
              <p className="text-sm text-slate-500">
                {caseRecord.category} • Client: <strong>{caseRecord.clientName}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Clinical Presentation & Demographic Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card className="md:col-span-2">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm">Presenting Issues & Clinical Context</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              <p className="whitespace-pre-wrap text-slate-700 leading-relaxed">
                {caseRecord.description}
              </p>

              <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-4 text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>
                    Intake:{" "}
                    {new Date(caseRecord.createdAt).toLocaleDateString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })}
                  </span>
                </div>
                {caseRecord.closedAt && (
                  <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                    <span>
                      Discharged:{" "}
                      {new Date(caseRecord.closedAt).toLocaleDateString("en-IN", {
                        timeZone: "Asia/Kolkata",
                      })}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-sm">Client Demographic Details</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Full Name:</span>
                <span className="font-semibold text-slate-900">{caseRecord.clientName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Age & Gender:</span>
                <span className="text-slate-800">
                  {caseRecord.clientAge} yrs, {caseRecord.clientGender}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Phone:</span>
                <span className="font-mono text-slate-800">{caseRecord.clientPhone}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Email:</span>
                <span className="font-mono text-slate-800 truncate max-w-[150px]">
                  {caseRecord.clientEmail || "—"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Workflow Progression & Sessions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <CaseStatusCard
            caseId={caseRecord.id}
            currentStatus={caseRecord.status}
            currentOutcome={caseRecord.outcome}
            closedAt={caseRecord.closedAt}
            userRole="therapist"
          />

          <CaseSessionsCard
            caseId={caseRecord.id}
            hasTherapist={true}
            sessions={sessionsList}
            patientName={caseRecord.clientName}
            defaultTherapistId={currentUser.id}
            userRole="therapist"
          />
        </div>

        {/* Clinical Notes & Audit Trail */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <CaseNotesCard
            caseId={caseRecord.id}
            notes={notesList}
          />

          <CaseTimeline events={eventsList} />
        </div>
      </div>
    </DashboardShell>
  );
}
