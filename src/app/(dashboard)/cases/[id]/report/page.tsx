import { notFound } from "next/navigation";
import { eq, asc, sql } from "drizzle-orm";
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
import { getCurrentUser } from "@/lib/session";
import {
  CaseProgressReport,
  type ProgressReportData,
  type SubmittedReportViewItem,
} from "@/components/cases/case-progress-report";
import { getTodayIST, formatDisplayDate } from "@/lib/date-utils";

interface CaseReportPageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: "Clinical Progress Report | Guild Club Services",
};

export default async function CaseReportPage({ params }: CaseReportPageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    notFound();
  }

  // Allowed roles: therapist (owner only), admin, super_admin
  const allowedRoles = ["therapist", "admin", "super_admin"];
  if (!allowedRoles.includes(currentUser.role)) {
    notFound();
  }

  const { id } = await params;

  // 1. Fetch case with client, therapist, and branch
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
      status: cases.status,
      outcome: cases.outcome,
      startDate: cases.startDate,
      roomNo: cases.roomNo,
      sex: cases.sex,
      createdAt: cases.createdAt,
      closedAt: cases.closedAt,
      currentTherapistId: cases.currentTherapistId,
      createdBy: cases.createdBy,
      therapistName: users.name,
      clientName: clients.fullName,
      clientAge: clients.age,
      clientGender: clients.gender,
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

  // 2. Authorization check: Therapist can only see their own cases
  const isOwner =
    currentUser.role === "therapist" &&
    (caseRecord.currentTherapistId === currentUser.id ||
      caseRecord.createdBy === currentUser.id);

  if (currentUser.role === "therapist" && !isOwner) {
    notFound();
  }

  // 3. Fetch photos (joining & present)
  const photos = await db
    .select({
      id: casePhotos.id,
      kind: casePhotos.kind,
      takenAt: casePhotos.takenAt,
    })
    .from(casePhotos)
    .where(eq(casePhotos.caseId, id))
    .orderBy(asc(casePhotos.takenAt));

  const joiningPhoto = photos.find((p) => p.kind === "joining");
  const presentPhoto = photos.find((p) => p.kind === "present");

  // 4. Fetch all sessions with notes (in date order)
  const sessionRows = await db
    .select({
      id: sessions.id,
      sessionDate: sessions.sessionDate,
      notes: sessions.notes,
      workDone: sessions.workDone,
      status: sessions.status,
    })
    .from(sessions)
    .where(eq(sessions.caseId, id))
    .orderBy(asc(sessions.sessionDate));

  // 5. Fetch all SUBMITTED progress reports in date order (oldest to newest)
  const submittedReportsRows = await db
    .select({
      id: progressReports.id,
      reportType: progressReports.reportType,
      reportDate: progressReports.reportDate,
      currentCondition: progressReports.currentCondition,
      progressText: progressReports.progressText,
      treatmentPlan: progressReports.treatmentPlan,
      remarks: progressReports.remarks,
      submittedAt: progressReports.submittedAt,
      authorName: users.name,
      versionCount: sql<number>`count(${progressReportVersions.id})::int`,
    })
    .from(progressReports)
    .innerJoin(users, eq(progressReports.authorId, users.id))
    .leftJoin(
      progressReportVersions,
      eq(progressReports.id, progressReportVersions.reportId)
    )
    .where(
      eq(progressReports.caseId, id)
    )
    .groupBy(progressReports.id, users.name)
    .orderBy(asc(progressReports.reportDate), asc(progressReports.submittedAt));

  // Only submitted reports are shown on the printable report page!
  const submittedReports: SubmittedReportViewItem[] = submittedReportsRows
    .filter((r) => r.submittedAt !== null)
    .map((r) => ({
      id: r.id,
      reportType: r.reportType as "update" | "final",
      reportDate: r.reportDate,
      currentCondition: r.currentCondition,
      progressText: r.progressText,
      treatmentPlan: r.treatmentPlan,
      remarks: r.remarks,
      submittedAt: r.submittedAt,
      authorName: r.authorName || "Therapist",
      isEdited: (r.versionCount || 0) > 0,
    }));

  const todayIST = getTodayIST();
  const startDateStr =
    caseRecord.startDate || caseRecord.createdAt.toISOString().slice(0, 10);
  const isClosed = caseRecord.status === "completed";
  const endDateStr =
    isClosed && caseRecord.closedAt
      ? new Date(caseRecord.closedAt).toISOString().slice(0, 10)
      : null;

  const effectiveEnd = endDateStr || todayIST;

  // Calculate days passed
  let totalDays = 0;
  if (startDateStr <= effectiveEnd) {
    const [sY, sM, sD] = startDateStr.split("-").map(Number);
    const [eY, eM, eD] = effectiveEnd.split("-").map(Number);
    const sDate = new Date(Date.UTC(sY, sM - 1, sD));
    const eDate = new Date(Date.UTC(eY, eM - 1, eD));
    totalDays = Math.max(
      1,
      Math.ceil((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    );
  }

  const heldSessions = sessionRows.filter(
    (s) => s.status === "held" && s.sessionDate
  );
  const sessionsDone = heldSessions.length;
  const missedDays = Math.max(0, totalDays - sessionsDone);
  const attendancePct =
    totalDays > 0 ? Math.round((sessionsDone / totalDays) * 100) : 0;

  const sessionNotes = heldSessions.map((s) => ({
    date: s.sessionDate!,
    note: s.notes || s.workDone || "Session completed.",
  }));

  const backUrl =
    currentUser.role === "therapist"
      ? `/therapist/cases/${caseRecord.id}`
      : `/admin/cases/${caseRecord.id}`;

  const reportData: ProgressReportData = {
    caseId: caseRecord.id,
    patientId: caseRecord.patientId || caseRecord.caseNumber,
    caseNumber: caseRecord.caseNumber,
    patientName: caseRecord.clientName,
    age: caseRecord.clientAge,
    sex: caseRecord.sex || caseRecord.clientGender,
    service: caseRecord.service || caseRecord.category,
    problem: caseRecord.problem || "",
    startingCondition: caseRecord.presentCondition || "Not recorded",
    presentCondition:
      caseRecord.presentConditionAtClose || caseRecord.presentCondition,
    startDate: startDateStr,
    endDate: endDateStr,
    isClosed,
    branchName: caseRecord.branchName || "Main Branch",
    roomNo: caseRecord.roomNo || "—",
    therapistName: caseRecord.therapistName || currentUser.name,
    outcome: caseRecord.outcome,
    closingSummary: caseRecord.closingNotes,
    totalDays,
    sessionsDone,
    missedDays,
    attendancePct,
    joiningPhotoUrl: joiningPhoto
      ? `/api/cases/${caseRecord.id}/photos/${joiningPhoto.id}`
      : null,
    joiningPhotoDate: joiningPhoto
      ? joiningPhoto.takenAt.toISOString().slice(0, 10)
      : null,
    presentPhotoUrl: presentPhoto
      ? `/api/cases/${caseRecord.id}/photos/${presentPhoto.id}`
      : null,
    presentPhotoDate: presentPhoto
      ? presentPhoto.takenAt.toISOString().slice(0, 10)
      : null,
    sessionNotes,
    submittedReports,
    isOwner,
    backUrl,
    printDate: formatDisplayDate(todayIST),
  };

  return <CaseProgressReport data={reportData} />;
}
