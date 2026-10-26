import React from "react";
import { eq, or, and, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { cases, clients, sessions, progressReports } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { getTodayIST } from "@/lib/date-utils";
import {
  TherapistPatientsTable,
  type TherapistPatientRow,
} from "@/components/therapist/therapist-patients-table";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export const metadata = {
  title: "My Patients | Guild Club Services",
};

export default async function TherapistCasesPage() {
  const currentUser = await requireRole("therapist");
  const todayIST = getTodayIST();

  // 1. Fetch all cases assigned to or created by this therapist
  const casesList = await db
    .select({
      id: cases.id,
      caseNumber: cases.caseNumber,
      patientId: cases.patientId,
      problem: cases.problem,
      description: cases.description,
      presentCondition: cases.presentCondition,
      service: cases.service,
      category: cases.category,
      status: cases.status,
      createdAt: cases.createdAt,
      clientName: clients.fullName,
    })
    .from(cases)
    .innerJoin(clients, eq(cases.clientId, clients.id))
    .where(
      or(
        eq(cases.currentTherapistId, currentUser.id),
        eq(cases.createdBy, currentUser.id)
      )
    )
    .orderBy(desc(cases.createdAt));

  // 2. Fetch today's sessions
  const caseIds = casesList.map((c) => c.id);
  const todaySessions =
    caseIds.length > 0
      ? await db
          .select({ caseId: sessions.caseId })
          .from(sessions)
          .where(
            and(
              eq(sessions.sessionDate, todayIST),
              eq(sessions.status, "held")
            )
          )
      : [];

  const todaySessionCaseIds = new Set(todaySessions.map((s) => s.caseId));

  // 3. Fetch cases with at least one submitted progress report
  const submittedReports =
    caseIds.length > 0
      ? await db
          .select({ caseId: progressReports.caseId })
          .from(progressReports)
          .where(
            and(
              inArray(progressReports.caseId, caseIds),
              eq(progressReports.status, "submitted")
            )
          )
      : [];

  const submittedReportCaseIds = new Set(submittedReports.map((r) => r.caseId));

  // 4. Transform to rows
  const patientRows: TherapistPatientRow[] = casesList.map((c) => ({
    id: c.id,
    patientId: c.patientId || c.caseNumber,
    caseNumber: c.caseNumber,
    clientName: c.clientName,
    problem: c.problem || c.description || "General Rehabilitation",
    presentCondition: c.presentCondition || "Intake assessment recorded",
    service: c.service || c.category,
    status: c.status,
    hasTodaySession: todaySessionCaseIds.has(c.id),
    hasSubmittedReport: submittedReportCaseIds.has(c.id),
  }));

  const activePatients = patientRows.filter((p) => p.status !== "completed");
  const activeCount = activePatients.length;
  const sessionsDoneToday = activePatients.filter((p) => p.hasTodaySession).length;
  const pendingSessionsToday = Math.max(0, activeCount - sessionsDoneToday);

  return (
    <DashboardShell user={currentUser} title="My Cases">
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        <TherapistPatientsTable
          patients={patientRows}
          activeCount={activeCount}
          sessionsDoneToday={sessionsDoneToday}
          pendingSessionsToday={pendingSessionsToday}
        />
      </div>
    </DashboardShell>
  );
}
