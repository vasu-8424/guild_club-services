import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { eq, desc, asc, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  cases,
  clients,
  branches,
  casePhotos,
  sessions,
  users,
  progressReports,
  progressReportVersions,
} from "@/db/schema";
import { requireRole } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { MonthCalendar, type CalendarSessionItem } from "@/components/cases/month-calendar";
import { CaseDetailTabContainer } from "@/components/cases/case-detail-tab-container";
import { CloseCaseModal } from "@/components/cases/close-case-modal";
import { getServiceLabel, getOutcomeLabel } from "@/lib/services";
import { formatDisplayDate, formatToISTDateString } from "@/lib/date-utils";
import {
  ArrowLeft,
  FileText,
  Calendar,
  Building,
  User,
  CheckCircle,
  Clock,
  ExternalLink,
} from "lucide-react";

interface TherapistCaseDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TherapistCaseDetailPage({
  params,
}: TherapistCaseDetailPageProps) {
  const currentUser = await requireRole("therapist");
  const { id } = await params;

  // 1. Fetch case details with joined client and branch
  const [caseRecord] = await db
    .select({
      id: cases.id,
      caseNumber: cases.caseNumber,
      patientId: cases.patientId,
      service: cases.service,
      category: cases.category,
      problem: cases.problem,
      description: cases.description,
      presentCondition: cases.presentCondition,
      presentConditionAtClose: cases.presentConditionAtClose,
      closingNotes: cases.closingNotes,
      status: cases.status,
      outcome: cases.outcome,
      startDate: cases.startDate,
      roomNo: cases.roomNo,
      sex: cases.sex,
      branchId: cases.branchId,
      branchName: branches.name,
      createdAt: cases.createdAt,
      closedAt: cases.closedAt,
      currentTherapistId: cases.currentTherapistId,
      createdBy: cases.createdBy,
      clientId: cases.clientId,
      clientName: clients.fullName,
      clientAge: clients.age,
      clientGender: clients.gender,
    })
    .from(cases)
    .innerJoin(clients, eq(cases.clientId, clients.id))
    .leftJoin(branches, eq(cases.branchId, branches.id))
    .where(eq(cases.id, id))
    .limit(1);

  if (!caseRecord) {
    notFound();
  }

  // 2. Strict authorization: Therapist can ONLY view their own cases
  if (caseRecord.currentTherapistId !== currentUser.id) {
    redirect("/therapist/dashboard");
  }

  // 3. Fetch case photos (joining and present)
  const photosList = await db
    .select({
      id: casePhotos.id,
      kind: casePhotos.kind,
      fileKey: casePhotos.fileKey,
      takenAt: casePhotos.takenAt,
    })
    .from(casePhotos)
    .where(eq(casePhotos.caseId, id))
    .orderBy(asc(casePhotos.takenAt));

  const joiningPhotos = photosList.filter((p) => p.kind === "joining");
  const presentPhotos = photosList.filter((p) => p.kind === "present");

  // 4. Fetch recorded sessions
  const rawSessions = await db
    .select({
      id: sessions.id,
      sessionDate: sessions.sessionDate,
      notes: sessions.notes,
      photoKey: sessions.photoKey,
      recordedAt: sessions.recordedAt,
    })
    .from(sessions)
    .where(eq(sessions.caseId, id))
    .orderBy(asc(sessions.sessionDate));

  const initialSessions: CalendarSessionItem[] = rawSessions
    .filter((s) => s.sessionDate !== null)
    .map((s) => ({
      id: s.id,
      sessionDate: s.sessionDate!,
      notes: s.notes,
      photoKey: s.photoKey,
      recordedAt: s.recordedAt ? s.recordedAt.toISOString() : null,
    }));

  const isClosed = caseRecord.status === "completed";
  const serviceLabel = getServiceLabel(caseRecord.service || caseRecord.category);
  const outcomeLabel = getOutcomeLabel(caseRecord.outcome);

  const closedDateStr = caseRecord.closedAt
    ? formatToISTDateString(caseRecord.closedAt)
    : null;

  // 5. Fetch progress reports
  const rawReports = await db
    .select({
      report: progressReports,
      authorName: users.name,
      versionCount: sql<number>`count(${progressReportVersions.id})::int`,
    })
    .from(progressReports)
    .innerJoin(users, eq(progressReports.authorId, users.id))
    .leftJoin(
      progressReportVersions,
      eq(progressReports.id, progressReportVersions.reportId)
    )
    .where(eq(progressReports.caseId, id))
    .groupBy(progressReports.id, users.name)
    .orderBy(desc(progressReports.createdAt));

  const now = Date.now();
  const initialReports = rawReports.map((r) => {
    const isOwner = r.report.authorId === currentUser.id;
    let canEdit = false;

    if (isOwner && !r.report.lockedAt && !isClosed) {
      if (r.report.status === "draft") {
        canEdit = true;
      } else if (r.report.status === "submitted" && r.report.submittedAt) {
        const elapsed = now - new Date(r.report.submittedAt).getTime();
        canEdit = elapsed <= 24 * 60 * 60 * 1000;
      }
    }

    return {
      id: r.report.id,
      caseId: r.report.caseId,
      authorId: r.report.authorId,
      authorName: r.authorName || "Therapist",
      reportType: r.report.reportType as "update" | "final",
      status: r.report.status as "draft" | "submitted",
      reportDate: r.report.reportDate,
      currentCondition: r.report.currentCondition,
      progressText: r.report.progressText,
      treatmentPlan: r.report.treatmentPlan,
      remarks: r.report.remarks,
      submittedAt: r.report.submittedAt,
      lockedAt: r.report.lockedAt,
      createdAt: r.report.createdAt,
      updatedAt: r.report.updatedAt,
      versionCount: r.versionCount || 0,
      canEdit,
    };
  });

  return (
    <DashboardShell user={currentUser} title={`Case ${caseRecord.patientId || caseRecord.caseNumber}`}>
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Navigation & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <Link
            href="/therapist/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800 transition-colors uppercase tracking-wider mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>My Patients</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-mono font-bold text-stone-900 tracking-tight">
              {caseRecord.patientId || caseRecord.caseNumber}
            </h1>
            <span
              data-testid="status-badge"
              className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                isClosed
                  ? "bg-stone-100 text-stone-700 border border-stone-300"
                  : "bg-emerald-100 text-emerald-800 border border-emerald-300"
              }`}
            >
              {isClosed ? "Closed" : "Active"}
            </span>
            <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 font-semibold">
              {serviceLabel}
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1 font-mono">
            Case Ref: {caseRecord.caseNumber}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/therapist/cases/${caseRecord.id}/report`}
            data-testid="progress-report-btn"
            className="inline-flex items-center gap-1.5 border border-stone-300 hover:bg-stone-100 text-stone-800 px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-none transition-colors"
          >
            <FileText className="w-4 h-4 text-stone-600" />
            <span>Progress report</span>
          </Link>

          {!isClosed && (
            <CloseCaseModal
              caseId={caseRecord.id}
              patientId={caseRecord.patientId || caseRecord.caseNumber}
              caseNumber={caseRecord.caseNumber}
            />
          )}
        </div>
      </div>

      {/* Patient & Intake Details Card */}
      <div className="bg-white border border-stone-200 p-6 rounded-none shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-stone-400 block">
              Patient Name
            </span>
            <span className="font-semibold text-stone-900 text-sm">
              {caseRecord.clientName}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-stone-400 block">
              Age & Sex
            </span>
            <span className="font-semibold text-stone-900 capitalize">
              {caseRecord.clientAge} yrs • {caseRecord.sex || caseRecord.clientGender}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-stone-400 block">
              Start Date
            </span>
            <span className="font-semibold text-stone-900">
              {caseRecord.startDate ? formatDisplayDate(caseRecord.startDate) : "—"}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-stone-400 block">
              Branch & Room
            </span>
            <span className="font-semibold text-stone-900">
              {caseRecord.branchName || "Main Branch"} • {caseRecord.roomNo || "—"}
            </span>
          </div>
        </div>

        {/* Clinical Complaint & Condition */}
        <div className="mt-4 pt-4 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-stone-400 block">
              Problem
            </span>
            <p className="text-stone-800 font-medium mt-0.5">
              {caseRecord.problem || caseRecord.description}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-stone-400 block">
              Present Condition (at Intake)
            </span>
            <p className="text-stone-800 mt-0.5">
              {caseRecord.presentCondition || "Not recorded"}
            </p>
          </div>
        </div>

        {/* Joining Photos */}
        {joiningPhotos.length > 0 && (
          <div className="mt-4 pt-4 border-t border-stone-100">
            <span className="text-[10px] uppercase font-bold text-stone-400 block mb-2">
              Joining Condition Photos ({joiningPhotos.length})
            </span>
            <div className="flex flex-wrap gap-3">
              {joiningPhotos.map((photo, i) => (
                <a
                  key={photo.id}
                  href={`/api/cases/${caseRecord.id}/photos/${photo.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-20 h-20 border border-stone-300 bg-stone-100 overflow-hidden group relative block"
                  title="View full photo"
                >
                  <img
                    src={`/api/cases/${caseRecord.id}/photos/${photo.id}`}
                    alt={`Joining photo ${i + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-stone-900/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                    <ExternalLink className="w-4 h-4" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Discharge Summary (if closed) */}
        {isClosed && (
          <div className="mt-4 pt-4 border-t border-stone-200 bg-stone-50 -mx-6 -mb-6 p-6">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-xs uppercase mb-2">
              <CheckCircle className="w-4 h-4 text-emerald-700" />
              <span>Case Closed — Discharge Summary</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs mb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400 block">
                  Outcome
                </span>
                <span className="font-semibold text-stone-900">
                  {outcomeLabel}
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[10px] uppercase font-bold text-stone-400 block">
                  Present Condition at Closing
                </span>
                <p className="text-stone-800">
                  {caseRecord.presentConditionAtClose || "—"}
                </p>
              </div>
            </div>
            {caseRecord.closingNotes && (
              <div className="text-xs">
                <span className="text-[10px] uppercase font-bold text-stone-400 block">
                  Closing Notes
                </span>
                <p className="text-stone-700 whitespace-pre-wrap mt-0.5">
                  {caseRecord.closingNotes}
                </p>
              </div>
            )}
            {presentPhotos.length > 0 && (
              <div className="mt-3">
                <span className="text-[10px] uppercase font-bold text-stone-400 block mb-1">
                  Present Condition Photos
                </span>
                <div className="flex flex-wrap gap-2">
                  {presentPhotos.map((photo, i) => (
                    <a
                      key={photo.id}
                      href={`/api/cases/${caseRecord.id}/photos/${photo.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-16 h-16 border border-stone-300 overflow-hidden block"
                    >
                      <img
                        src={`/api/cases/${caseRecord.id}/photos/${photo.id}`}
                        alt={`Present photo ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabbed Clinical Operations: Treatment Calendar + Progress Report */}
      <CaseDetailTabContainer
        caseId={caseRecord.id}
        patientId={caseRecord.patientId || caseRecord.caseNumber}
        startDate={caseRecord.startDate || formatToISTDateString(caseRecord.createdAt)}
        closedAtDate={closedDateStr}
        isClosed={isClosed}
        isOwner={caseRecord.currentTherapistId === currentUser.id || caseRecord.createdBy === currentUser.id}
        initialSessions={initialSessions}
        initialReports={initialReports}
      />
    </div>
    </DashboardShell>
  );
}
