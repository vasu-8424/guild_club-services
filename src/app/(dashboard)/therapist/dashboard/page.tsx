import React from "react";
import { cookies } from "next/headers";
import { eq, or, and, desc, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { cases, clients, sessions, loginRecords } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { getTodayIST } from "@/lib/date-utils";
import { getScope } from "@/lib/scope";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { LocationGate } from "@/components/therapist/location-gate";
import { DailyBoardView } from "@/components/therapist/daily-board-view";
import type { CaseTileData } from "@/components/therapist/case-tile";

export const metadata = {
  title: "Today's Sessions | Guild Club Services",
};

interface TherapistDashboardPageProps {
  searchParams?: Promise<{
    branch?: string;
  }>;
}

export default async function TherapistDashboardPage({
  searchParams,
}: TherapistDashboardPageProps) {
  const currentUser = await requireRole("therapist");
  const rawParams = searchParams ? await searchParams : {};
  const branchParam = typeof rawParams.branch === "string" ? rawParams.branch : undefined;

  const todayIST = getTodayIST();

  // 1. Verify Therapist Sign-In Location Status
  // LOCATION IS REQUIRED TO USE THE BOARD. Direct URLs to the board are also blocked until captured.
  let activeRecordId = currentUser.loginRecordId;
  if (!activeRecordId) {
    try {
      const cookieStore = await cookies();
      activeRecordId = cookieStore.get("gcs_latest_login_id")?.value || null;
    } catch {
      // ignore
    }
  }

  let activeLoginRecord: { id: string; signInLocationStatus: "pending" | "captured" | "denied" | "unavailable" } | null = null;

  if (activeRecordId) {
    const [rec] = await db
      .select({
        id: loginRecords.id,
        signInLocationStatus: loginRecords.signInLocationStatus,
      })
      .from(loginRecords)
      .where(
        and(
          eq(loginRecords.id, activeRecordId),
          eq(loginRecords.userId, currentUser.id)
        )
      )
      .limit(1);
    if (rec) activeLoginRecord = rec;
  }

  if (!activeLoginRecord) {
    const [latest] = await db
      .select({
        id: loginRecords.id,
        signInLocationStatus: loginRecords.signInLocationStatus,
      })
      .from(loginRecords)
      .where(eq(loginRecords.userId, currentUser.id))
      .orderBy(desc(loginRecords.signedInAt))
      .limit(1);
    if (latest) activeLoginRecord = latest;
  }

  // If location has not been captured, server strictly renders the Location Gate and blocks the board
  if (!activeLoginRecord || activeLoginRecord.signInLocationStatus !== "captured") {
    return (
      <DashboardShell user={currentUser} title="Today's Sessions">
        <LocationGate
          recordId={activeLoginRecord?.id}
          initialStatus={activeLoginRecord?.signInLocationStatus || "pending"}
        />
      </DashboardShell>
    );
  }

  // 2. Resolve branch scope
  const scope = await getScope(currentUser, branchParam);

  // 3. Query active cases belonging to this therapist in the selected branch
  // Only active cases where startDate <= todayIST appear
  const caseConditions = [
    or(
      eq(cases.currentTherapistId, currentUser.id),
      eq(cases.createdBy, currentUser.id)
    ),
    sql`${cases.status} != 'completed'`,
    isNull(cases.closedAt),
    sql`(${cases.startDate} IS NULL OR ${cases.startDate} <= ${todayIST})`,
  ];

  if (scope.activeBranchId) {
    caseConditions.push(eq(cases.branchId, scope.activeBranchId));
  } else if (scope.allowedBranchIds.length > 0) {
    caseConditions.push(inArray(cases.branchId, scope.allowedBranchIds));
  } else {
    caseConditions.push(sql`1=0`);
  }

  const rawCases = await db
    .select({
      id: cases.id,
      patientId: cases.patientId,
      caseNumber: cases.caseNumber,
      service: cases.service,
      category: cases.category,
      roomNo: cases.roomNo,
      status: cases.status,
      presentCondition: cases.presentCondition,
      clientName: clients.fullName,
    })
    .from(cases)
    .innerJoin(clients, eq(cases.clientId, clients.id))
    .where(and(...caseConditions))
    .orderBy(cases.patientId);

  // 4. Query today's sessions for these cases
  const caseIds = rawCases.map((c) => c.id);
  const todaySessions =
    caseIds.length > 0
      ? await db
          .select({
            id: sessions.id,
            caseId: sessions.caseId,
            notes: sessions.notes,
            presentConditionSnapshot: sessions.presentConditionSnapshot,
            signatureKey: sessions.signatureKey,
            sessionDate: sessions.sessionDate,
            status: sessions.status,
          })
          .from(sessions)
          .where(
            and(
              inArray(sessions.caseId, caseIds),
              eq(sessions.sessionDate, todayIST),
              eq(sessions.status, "held")
            )
          )
      : [];

  const todaySessionsMap = new Map<string, (typeof todaySessions)[0]>();
  todaySessions.forEach((s) => {
    todaySessionsMap.set(s.caseId, s);
  });

  // 5. Construct Tile data
  const tilesData: CaseTileData[] = rawCases.map((c) => {
    const session = todaySessionsMap.get(c.id);
    return {
      id: c.id,
      patientId: c.patientId || c.caseNumber,
      clientName: c.clientName,
      service: c.service,
      category: c.category,
      roomNo: c.roomNo,
      status: c.status,
      presentCondition: c.presentCondition,
      todaySession: session
        ? {
            id: session.id,
            notes: session.notes,
            presentConditionSnapshot: session.presentConditionSnapshot,
            signatureKey: session.signatureKey,
            sessionDate: session.sessionDate || todayIST,
          }
        : null,
    };
  });

  const branchLabel = scope.activeBranch?.name || "All Branches";

  return (
    <DashboardShell user={currentUser} title="Today's Sessions">
      <DailyBoardView
        casesList={tilesData}
        branchName={branchLabel}
        todayIST={todayIST}
      />
    </DashboardShell>
  );
}
