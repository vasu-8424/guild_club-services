import { notFound } from "next/navigation";
import Link from "next/link";
import { eq, desc, asc, and, ne, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  cases,
  clients,
  users,
  therapistProfiles,
  caseNotes,
  sessions,
  caseEvents,
  therapistRoomAssignments,
  branches,
  casePhotos,
} from "@/db/schema";
import { requireRole } from "@/lib/session";
import { formatUserName } from "@/lib/format-user";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { MonthCalendar, type CalendarSessionItem } from "@/components/cases/month-calendar";
import { formatToISTDateString } from "@/lib/date-utils";
import { CaseAssignCard } from "./case-assign-card";
import { CaseStatusCard } from "./case-status-card";
import { CaseNotesCard } from "./case-notes-card";
import { CaseSessionsCard } from "./case-sessions-card";
import { CaseTimeline } from "./case-timeline";
import { CaseDetailTabs } from "./case-detail-tabs";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Calendar,
  FileText,
  Stethoscope,
  CheckCircle2,
  Clock,
} from "lucide-react";

interface CaseDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminCaseDetailPage({ params }: CaseDetailPageProps) {
  const currentUser = await requireRole("admin", "super_admin");
  const { id } = await params;

  // 1. Fetch case with client and current therapist
  const [caseRecord] = await db
    .select({
      id: cases.id,
      caseNumber: cases.caseNumber,
      patientId: cases.patientId,
      service: cases.service,
      category: cases.category,
      problem: cases.problem,
      presentCondition: cases.presentCondition,
      presentConditionAtClose: cases.presentConditionAtClose,
      closingNotes: cases.closingNotes,
      priority: cases.priority,
      description: cases.description,
      status: cases.status,
      outcome: cases.outcome,
      startDate: cases.startDate,
      roomNo: cases.roomNo,
      createdAt: cases.createdAt,
      closedAt: cases.closedAt,
      currentTherapistId: cases.currentTherapistId,
      clientId: cases.clientId,
      clientName: clients.fullName,
      clientEmail: clients.email,
      clientPhone: clients.phone,
      clientAge: clients.age,
      clientGender: clients.gender,
      therapistName: users.name,
      therapistDeletedAt: users.deletedAt,
      therapistEmail: users.email,
      branchName: branches.name,
    })
    .from(cases)
    .innerJoin(clients, eq(cases.clientId, clients.id))
    .leftJoin(users, eq(cases.currentTherapistId, users.id))
    .leftJoin(branches, eq(cases.branchId, branches.id))
    .where(eq(cases.id, id))
    .limit(1);

  if (!caseRecord) {
    notFound();
  }

  // 2. Fetch notes
  const rawNotesList = await db
    .select({
      id: caseNotes.id,
      note: caseNotes.note,
      createdAt: caseNotes.createdAt,
      authorName: users.name,
      authorDeletedAt: users.deletedAt,
      authorRole: users.role,
    })
    .from(caseNotes)
    .innerJoin(users, eq(caseNotes.authorId, users.id))
    .where(eq(caseNotes.caseId, id))
    .orderBy(desc(caseNotes.createdAt));

  const notesList = rawNotesList.map((n) => ({
    ...n,
    authorName: formatUserName(n.authorName, n.authorDeletedAt),
  }));

  // 3. Fetch sessions with clinical proof details and room assignment
  const rawSessionsList = await db
    .select({
      id: sessions.id,
      scheduledAt: sessions.scheduledAt,
      status: sessions.status,
      notes: sessions.notes,
      sessionDate: sessions.sessionDate,
      inTimeAt: sessions.inTimeAt,
      inTimePhotoKey: sessions.inTimePhotoKey,
      outTimeAt: sessions.outTimeAt,
      outTimePhotoKey: sessions.outTimePhotoKey,
      workDone: sessions.workDone,
      patientSignatureKey: sessions.patientSignatureKey,
      completedAt: sessions.completedAt,
      therapistName: users.name,
      therapistDeletedAt: users.deletedAt,
      roomNo: therapistRoomAssignments.roomNo,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.therapistId, users.id))
    .leftJoin(
      therapistRoomAssignments,
      and(
        eq(therapistRoomAssignments.therapistId, sessions.therapistId),
        sql`${therapistRoomAssignments.assignedDate} = (${sessions.scheduledAt} AT TIME ZONE 'Asia/Kolkata')::date`
      )
    )
    .where(eq(sessions.caseId, id))
    .orderBy(desc(sessions.scheduledAt));

  const sessionsList = rawSessionsList.map((s) => ({
    ...s,
    therapistName: formatUserName(s.therapistName, s.therapistDeletedAt),
  }));

  const calendarSessions: CalendarSessionItem[] = rawSessionsList
    .filter((s) => s.sessionDate !== null)
    .map((s) => ({
      id: s.id,
      sessionDate: s.sessionDate!,
      notes: s.notes || s.workDone,
      photoKey: s.outTimePhotoKey || null,
    }));

  // 4. Fetch audit events
  const rawEventsList = await db
    .select({
      id: caseEvents.id,
      eventType: caseEvents.eventType,
      actorRole: caseEvents.actorRole,
      actorName: users.name,
      actorDeletedAt: users.deletedAt,
      fromStatus: caseEvents.fromStatus,
      toStatus: caseEvents.toStatus,
      metadata: caseEvents.metadata,
      occurredAt: caseEvents.occurredAt,
    })
    .from(caseEvents)
    .innerJoin(users, eq(caseEvents.actorId, users.id))
    .where(eq(caseEvents.caseId, id))
    .orderBy(desc(caseEvents.occurredAt));

  const eventsList = rawEventsList.map((e) => ({
    ...e,
    actorName: formatUserName(e.actorName, e.actorDeletedAt),
  }));

  // 5. Fetch active therapists with capacities (excluding deleted)
  const activeTherapists = await db
    .select({
      id: users.id,
      name: users.name,
      specialization: therapistProfiles.specialization,
      maxOpenCases: therapistProfiles.maxOpenCases,
    })
    .from(users)
    .innerJoin(therapistProfiles, eq(users.id, therapistProfiles.userId))
    .where(and(eq(users.role, "therapist"), eq(users.isActive, true), isNull(users.deletedAt)))
    .orderBy(users.name);

  const openCasesCounts = await db
    .select({
      therapistId: cases.currentTherapistId,
      count: sql<number>`count(*)::int`,
    })
    .from(cases)
    .where(
      and(
        isNotNull(cases.currentTherapistId),
        ne(cases.status, "completed")
      )
    )
    .groupBy(cases.currentTherapistId);

  const openCasesMap = new Map<string, number>();
  for (const row of openCasesCounts) {
    if (row.therapistId) {
      openCasesMap.set(row.therapistId, row.count);
    }
  }

  const therapistsWithCapacity = activeTherapists.map((t) => ({
    id: t.id,
    name: t.name,
    specialization: t.specialization,
    maxOpenCases: t.maxOpenCases,
    openCases: openCasesMap.get(t.id) ?? 0,
  }));

  const isClosed = caseRecord.status === "completed";

  return (
    <DashboardShell user={currentUser} title={`Case ${caseRecord.caseNumber}`}>
      <div className="space-y-6">
        {/* Top Header with Case Number, Badges, and Back Link */}
        <div className="border-b border-slate-200/80 pb-5">
          <Link
            href="/admin/cases"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Cases</span>
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-mono text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {caseRecord.patientId || caseRecord.caseNumber}
                </span>
                <StatusBadge status={caseRecord.status} />
                <PriorityBadge priority={caseRecord.priority} />
              </div>
              <p className="mt-1 text-xs text-slate-500 font-mono">
                Case Ref: {caseRecord.caseNumber} &bull; Client: <strong className="text-slate-800 font-semibold font-sans">{caseRecord.clientName}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/admin/cases/${caseRecord.id}/report`}
                data-testid="admin-progress-report-btn"
                className="inline-flex items-center gap-1.5 border border-slate-300 hover:bg-slate-100 text-slate-800 px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-none transition-colors"
              >
                <FileText className="w-4 h-4 text-slate-600" />
                <span>Progress report</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Read-Only Month Calendar for Admin */}
        <div className="bg-white border border-slate-200 p-5 rounded-none shadow-xs">
          <MonthCalendar
            caseId={caseRecord.id}
            startDate={caseRecord.startDate || formatToISTDateString(caseRecord.createdAt)}
            closedAtDate={caseRecord.closedAt ? formatToISTDateString(caseRecord.closedAt) : null}
            isClosed={isClosed}
            isReadOnly={true}
            initialSessions={calendarSessions}
          />
        </div>

        {/* 2-Column Layout: Left Tabbed Details (2/3) + Right Side Panel (1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Tabbed Overview | Sessions | Notes | History */}
          <div className="lg:col-span-2">
            <CaseDetailTabs
              sessionsCount={sessionsList.length}
              notesCount={notesList.length}
              historyCount={eventsList.length}
              overviewContent={
                <div className="space-y-6">
                  {/* Case Presenting Issues */}
                  <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Presenting Issues & Clinical Description
                    </h3>
                    <p className="whitespace-pre-wrap text-xs text-slate-700 leading-relaxed">
                      {caseRecord.description}
                    </p>
                    <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-4 text-xs text-slate-500">
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
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>
                            Discharged:{" "}
                            {new Date(caseRecord.closedAt).toLocaleDateString("en-IN", {
                              timeZone: "Asia/Kolkata",
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status & Outcome Controls */}
                  <CaseStatusCard
                    caseId={caseRecord.id}
                    currentStatus={caseRecord.status}
                    currentOutcome={caseRecord.outcome}
                    closedAt={caseRecord.closedAt}
                    userRole={currentUser.role}
                  />

                  {/* Therapist Assignment Controls */}
                  <CaseAssignCard
                    caseId={caseRecord.id}
                    currentTherapistId={caseRecord.currentTherapistId}
                    currentTherapistName={formatUserName(
                      caseRecord.therapistName,
                      caseRecord.therapistDeletedAt
                    )}
                    isClosed={isClosed}
                    therapists={therapistsWithCapacity}
                  />
                </div>
              }
              sessionsContent={
                <CaseSessionsCard
                  caseId={caseRecord.id}
                  hasTherapist={Boolean(caseRecord.currentTherapistId)}
                  sessions={sessionsList}
                  patientName={caseRecord.clientName}
                  therapists={therapistsWithCapacity}
                  defaultTherapistId={caseRecord.currentTherapistId}
                  userRole={currentUser.role}
                />
              }
              notesContent={
                <CaseNotesCard caseId={caseRecord.id} notes={notesList} />
              }
              historyContent={<CaseTimeline events={eventsList} />}
            />
          </div>

          {/* Right Side Panel: Client and Assigned Therapist */}
          <div className="space-y-5">
            {/* Client Info Card */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3.5">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <User className="h-4 w-4 text-teal-700" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Client Details
                </h3>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Name:</span>
                  <span className="font-semibold text-slate-900">{caseRecord.clientName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Age & Gender:</span>
                  <span className="text-slate-800">
                    {caseRecord.clientAge} yrs, {caseRecord.clientGender}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Phone:</span>
                  <span className="font-mono text-slate-800">{caseRecord.clientPhone}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Email:</span>
                  <span className="font-mono text-slate-800 truncate max-w-[150px]">
                    {caseRecord.clientEmail || "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Assigned Therapist Card */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3.5">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <Stethoscope className="h-4 w-4 text-teal-700" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Assigned Therapist
                </h3>
              </div>

              {caseRecord.therapistName ? (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Practitioner:</span>
                    <span className="font-semibold text-slate-900">
                      {formatUserName(caseRecord.therapistName, caseRecord.therapistDeletedAt)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Email:</span>
                    <span className="font-mono text-slate-800 truncate max-w-[150px]">
                      {caseRecord.therapistEmail}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-2 text-center text-xs text-slate-400">
                  <p className="italic">No therapist assigned yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
