import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { eq, desc, asc, and, sql } from "drizzle-orm";
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
import { getScope } from "@/lib/scope";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import type { CalendarSessionItem } from "@/components/cases/month-calendar";
import { CaseDetailTabContainer } from "@/components/cases/case-detail-tab-container";
import { CloseCaseModal } from "@/components/cases/close-case-modal";
import { getServiceLabel, getOutcomeLabel } from "@/lib/services";
import { formatDisplayDate, formatToISTDateString } from "@/lib/date-utils";
import {
  ArrowLeft,
  FileText,
  CheckCircle,
  ExternalLink,
} from "lucide-react";

interface TherapistCaseDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Async subcomponent for Joining Condition Photos loaded via Suspense
 */
async function CaseJoiningPhotos({ caseId }: { caseId: string }) {
  const joiningPhotos = await db
    .select({
      id: casePhotos.id,
      kind: casePhotos.kind,
      fileKey: casePhotos.fileKey,
      takenAt: casePhotos.takenAt,
    })
    .from(casePhotos)
    .where(and(eq(casePhotos.caseId, caseId), eq(casePhotos.kind, "joining")))
    .orderBy(asc(casePhotos.takenAt));

  if (joiningPhotos.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-stone-100">
      <span className="text-[10px] uppercase font-bold text-stone-400 block mb-2">
        Joining Condition Photos ({joiningPhotos.length})
      </span>
      <div className="flex flex-wrap gap-3">
        {joiningPhotos.map((photo, i) => (
          <a
            key={photo.id}
            href={`/api/cases/${caseId}/photos/${photo.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-20 h-20 border border-stone-300 bg-stone-100 overflow-hidden group relative block aspect-square rounded-none"
            title="View full photo"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/cases/${caseId}/photos/${photo.id}`}
              alt={`Joining photo ${i + 1}`}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
            <div className="absolute inset-0 bg-stone-900/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
              <ExternalLink className="w-4 h-4" />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

/**
 * Async subcomponent for Present Condition Photos (when case is closed)
 */
async function CasePresentPhotos({ caseId }: { caseId: string }) {
  const presentPhotos = await db
    .select({
      id: casePhotos.id,
      kind: casePhotos.kind,
      fileKey: casePhotos.fileKey,
      takenAt: casePhotos.takenAt,
    })
    .from(casePhotos)
    .where(and(eq(casePhotos.caseId, caseId), eq(casePhotos.kind, "present")))
    .orderBy(asc(casePhotos.takenAt));

  if (presentPhotos.length === 0) return null;

  return (
    <div className="mt-3">
      <span className="text-[10px] uppercase font-bold text-stone-400 block mb-1">
        Present Condition Photos
      </span>
      <div className="flex flex-wrap gap-2">
        {presentPhotos.map((photo, i) => (
          <a
            key={photo.id}
            href={`/api/cases/${caseId}/photos/${photo.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-16 h-16 border border-stone-300 overflow-hidden block aspect-square rounded-none"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/cases/${caseId}/photos/${photo.id}`}
              alt={`Present photo ${i + 1}`}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </a>
        ))}
      </div>
    </div>
  );
}

/**
 * Async subcomponent for Tabs (Sessions & Progress Reports) loaded via Suspense
 */
async function CaseDetailAsyncTabs({
  caseRecord,
  currentUserId,
  isClosed,
  closedDateStr,
}: {
  caseRecord: {
    id: string;
    patientId: string | null;
    caseNumber: string;
    startDate: string | null;
    createdAt: Date;
    currentTherapistId: string | null;
    createdBy: string;
  };
  currentUserId: string;
  isClosed: boolean;
  closedDateStr: string | null;
}) {
  const [rawSessions, rawReports] = await Promise.all([
    // Query 1: recorded sessions (indexed on case_id, session_date)
    db
      .select({
        id: sessions.id,
        sessionDate: sessions.sessionDate,
        notes: sessions.notes,
        photoKey: sessions.photoKey,
        recordedAt: sessions.recordedAt,
      })
      .from(sessions)
      .where(eq(sessions.caseId, caseRecord.id))
      .orderBy(asc(sessions.sessionDate)),

    // Query 2: progress reports
    db
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
      .where(eq(progressReports.caseId, caseRecord.id))
      .groupBy(progressReports.id, users.name)
      .orderBy(desc(progressReports.createdAt)),
  ]);

  const initialSessions: CalendarSessionItem[] = rawSessions
    .filter((s) => s.sessionDate !== null)
    .map((s) => ({
      id: s.id,
      sessionDate: s.sessionDate!,
      notes: s.notes,
      photoKey: s.photoKey,
      recordedAt: s.recordedAt ? s.recordedAt.toISOString() : null,
    }));

  const now = Date.now();
  const initialReports = rawReports.map((r) => {
    const isReportOwner = r.report.authorId === currentUserId;
    let canEdit = false;

    if (isReportOwner && !r.report.lockedAt && !isClosed) {
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
    <CaseDetailTabContainer
      caseId={caseRecord.id}
      patientId={caseRecord.patientId || caseRecord.caseNumber}
      startDate={caseRecord.startDate || formatToISTDateString(caseRecord.createdAt)}
      closedAtDate={closedDateStr}
      isClosed={isClosed}
      isOwner={caseRecord.currentTherapistId === currentUserId || caseRecord.createdBy === currentUserId}
      initialSessions={initialSessions}
      initialReports={initialReports}
    />
  );
}

function TabsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex border-b border-stone-200 bg-white">
        <div className="h-10 w-44 bg-stone-200 rounded-none mr-2" />
        <div className="h-10 w-36 bg-stone-100 rounded-none" />
      </div>
      <div className="bg-white border border-stone-200 p-6 h-64 rounded-none" />
    </div>
  );
}

function PhotosSkeleton() {
  return (
    <div className="mt-4 pt-4 border-t border-stone-100 animate-pulse">
      <div className="h-3 w-36 bg-stone-200 rounded-none mb-2" />
      <div className="flex gap-3">
        <div className="w-20 h-20 bg-stone-200 rounded-none" />
        <div className="w-20 h-20 bg-stone-200 rounded-none" />
      </div>
    </div>
  );
}

export default async function TherapistCaseDetailPage({
  params,
}: TherapistCaseDetailPageProps) {
  const currentUser = await requireRole("therapist");
  const { id } = await params;

  // 1. Single small query: Fetch case header + intake details
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

  // 2. Authorization
  const isOwner =
    caseRecord.currentTherapistId === currentUser.id ||
    caseRecord.createdBy === currentUser.id;

  if (!isOwner) {
    redirect("/therapist/dashboard");
  }

  const scope = await getScope(currentUser);
  if (!scope.canAccessBranch(caseRecord.branchId)) {
    redirect("/therapist/dashboard");
  }

  const isClosed = caseRecord.status === "completed";
  const serviceLabel = getServiceLabel(caseRecord.service || caseRecord.category);
  const outcomeLabel = getOutcomeLabel(caseRecord.outcome);
  const closedDateStr = caseRecord.closedAt
    ? formatToISTDateString(caseRecord.closedAt)
    : null;

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

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <h1 className="text-2xl font-mono font-bold text-stone-900 tracking-tight">
                {caseRecord.patientId || caseRecord.caseNumber}
              </h1>

              {/* Status & Service Badges: Equal 36px height, equal padding, 2-column grid on phones */}
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
                <span
                  data-testid="status-badge"
                  className={`inline-flex items-center justify-center h-[36px] min-h-[36px] px-3.5 text-xs font-bold uppercase tracking-wider border rounded-none truncate text-center ${
                    isClosed
                      ? "bg-stone-100 text-stone-700 border-stone-300"
                      : "bg-emerald-100 text-emerald-800 border-emerald-300"
                  }`}
                >
                  {isClosed ? "Closed" : "Active"}
                </span>
                <span
                  data-testid="service-badge"
                  className="inline-flex items-center justify-center h-[36px] min-h-[36px] px-3.5 text-xs font-bold uppercase tracking-wider border rounded-none truncate text-center bg-emerald-50 text-emerald-800 border-emerald-200"
                >
                  {serviceLabel}
                </span>
              </div>
            </div>

            <p className="text-xs text-stone-500 mt-1 font-mono">
              Case Ref: {caseRecord.caseNumber}
            </p>
          </div>

          {/* Action buttons: Equal 48px height, equal padding, 2-column grid on phones */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
            <Link
              href={`/therapist/cases/${caseRecord.id}/report`}
              data-testid="progress-report-btn"
              className="inline-flex items-center justify-center h-[48px] min-h-[48px] px-4 text-xs font-semibold uppercase tracking-wider border border-stone-300 hover:bg-stone-100 text-stone-800 rounded-none transition-colors gap-1.5 w-full sm:w-auto text-center"
            >
              <FileText className="w-4 h-4 text-stone-600 shrink-0" />
              <span className="truncate">Progress report</span>
            </Link>

            {!isClosed && (
              <div className="w-full sm:w-auto">
                <CloseCaseModal
                  caseId={caseRecord.id}
                  patientId={caseRecord.patientId || caseRecord.caseNumber}
                  caseNumber={caseRecord.caseNumber}
                />
              </div>
            )}
          </div>
        </div>

        {/* Patient & Intake Details Card (First Paint Immediate) */}
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
                {caseRecord.branchName || "—"} • {caseRecord.roomNo || "—"}
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

          {/* Joining Photos (Lazy loaded in Suspense) */}
          <Suspense fallback={<PhotosSkeleton />}>
            <CaseJoiningPhotos caseId={caseRecord.id} />
          </Suspense>

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
              <Suspense fallback={<PhotosSkeleton />}>
                <CasePresentPhotos caseId={caseRecord.id} />
              </Suspense>
            </div>
          )}
        </div>

        {/* Tabbed Operations: Treatment Calendar + Progress Report (Suspense boundary) */}
        <Suspense fallback={<TabsSkeleton />}>
          <CaseDetailAsyncTabs
            caseRecord={caseRecord}
            currentUserId={currentUser.id}
            isClosed={isClosed}
            closedDateStr={closedDateStr}
          />
        </Suspense>
      </div>
    </DashboardShell>
  );
}
