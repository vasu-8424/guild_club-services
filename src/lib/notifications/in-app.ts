import { db } from "@/db";
import { inAppNotifications, users, caseEvents, cases, sessions } from "@/db/schema";
import { eq, and, or, inArray, sql, isNull, desc } from "drizzle-orm";
import { getEnv } from "@/lib/env";
import { queueEmail } from "@/lib/email";

export interface NotifyCaseClosedParams {
  tx: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
  caseId: string;
  caseNumber: string;
  outcome: string;
  therapistName: string;
  createdById: string;
  closedAt: Date;
  /** Branch this case belongs to; drives notification visibility */
  branchId?: string | null;
}

/**
 * Triggered when a case is closed.
 * - Creates in-app notifications inside the ongoing database transaction.
 * - Recipients: creating admin, assigning admin, and all Super Admins (if NOTIFY_SUPER_ADMINS_ON_CLOSE).
 * - De-duplicated; skips deactivated or deleted users.
 * - Queues outbox email for creating and assigning admins only.
 */
export async function notifyCaseClosed({
  tx,
  caseId,
  caseNumber,
  outcome,
  therapistName,
  createdById,
  closedAt,
  branchId,
}: NotifyCaseClosedParams): Promise<void> {
  const env = getEnv();
  const closedAtIst = closedAt.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
  });

  // 1. Find assigning admin from latest assignment event
  const [latestAssignEvent] = await tx
    .select({ actorId: caseEvents.actorId })
    .from(caseEvents)
    .where(
      and(
        eq(caseEvents.caseId, caseId),
        or(
          eq(caseEvents.eventType, "case_assigned"),
          eq(caseEvents.eventType, "case_reassigned")
        )
      )
    )
    .orderBy(desc(caseEvents.occurredAt))
    .limit(1);

  const adminIds = new Set<string>();
  if (createdById) adminIds.add(createdById);
  if (latestAssignEvent?.actorId) adminIds.add(latestAssignEvent.actorId);

  // 2. Fetch creating and assigning admins
  const clinicAdmins = adminIds.size > 0
    ? await tx
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          isActive: users.isActive,
          deletedAt: users.deletedAt,
        })
        .from(users)
        .where(
          and(
            inArray(users.id, Array.from(adminIds)),
            eq(users.isActive, true),
            isNull(users.deletedAt)
          )
        )
    : [];

  // Fallback: If case was therapist-created and no clinic admin is in adminIds, notify all active Admins
  if (clinicAdmins.length === 0) {
    const defaultAdmins = await tx
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(
        and(
          eq(users.role, "admin"),
          eq(users.isActive, true),
          isNull(users.deletedAt)
        )
      );
    clinicAdmins.push(...defaultAdmins);
  }

  // 3. Fetch all Super Admins if enabled
  let superAdmins: typeof clinicAdmins = [];
  if (env.NOTIFY_SUPER_ADMINS_ON_CLOSE) {
    superAdmins = await tx
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(
        and(
          eq(users.role, "super_admin"),
          eq(users.isActive, true),
          isNull(users.deletedAt)
        )
      );
  }

  // 4. De-duplicate in-app notification recipients
  const inAppRecipientsMap = new Map<string, (typeof clinicAdmins)[number]>();
  for (const adm of [...clinicAdmins, ...superAdmins]) {
    inAppRecipientsMap.set(adm.id, adm);
  }

  // 5. Query number of sessions held for this case
  const [sessionsHeldRow] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(sessions)
    .where(and(eq(sessions.caseId, caseId), eq(sessions.status, "held")));
  const sessionsHeldCount = sessionsHeldRow?.count ?? 0;

  const formattedOutcome = outcome.charAt(0).toUpperCase() + outcome.slice(1);
  const priority = outcome === "unsuccessful" ? "high" : "normal";

  // 6. Create in-app notification for each de-duplicated recipient
  for (const recipient of inAppRecipientsMap.values()) {
    await tx.insert(inAppNotifications).values({
      userId: recipient.id,
      type: "case_closed",
      title: `Case ${caseNumber} closed`,
      body: `Closed by ${therapistName} as ${formattedOutcome}`,
      priority,
      isRead: false,
      caseId,
      // Branch-scoped: Super Admins see the specific branch; Admins see their branch
      branchId: branchId || null,
      data: {
        caseNumber,
        therapistName,
        outcome,
        closedAtIst,
        sessionsHeld: sessionsHeldCount,
        sessionsHeldCount,
        caseId,
      },
    });
  }

  // 7. Queue email notification for creating and assigning clinic admins only
  for (const adm of clinicAdmins) {
    if (adm.role === "super_admin") continue; // Super Admins receive in-app only per spec

    await queueEmail(tx as any, {
      toEmail: adm.email,
      toName: adm.name,
      template: "case_closed",
      payload: {
        adminName: adm.name,
        therapistName,
        caseNumber,
        caseId,
        outcome,
        closedAt: closedAtIst,
      },
    });
  }
}

export interface NotifySessionCompletedParams {
  tx: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
  sessionId: string;
  caseId: string;
  therapistId: string;
  therapistName: string;
}

/**
 * Triggered when a session turns green (completed/held).
 * - Notifies the assigning admin with a low-priority in-app notification.
 * - Groups notifications from the same therapist completed within 30 minutes into one row.
 * - Controlled by NOTIFY_ADMIN_ON_SESSION_COMPLETE setting (default true).
 */
export async function notifySessionCompleted({
  tx,
  sessionId,
  caseId,
  therapistId,
  therapistName,
}: NotifySessionCompletedParams): Promise<void> {
  const env = getEnv();
  if (!env.NOTIFY_ADMIN_ON_SESSION_COMPLETE) {
    return;
  }

  // 1. Find case and assigning admin
  const [targetCase] = await tx
    .select({
      caseNumber: cases.caseNumber,
      createdBy: cases.createdBy,
      branchId: cases.branchId,
    })
    .from(cases)
    .where(eq(cases.id, caseId))
    .limit(1);

  if (!targetCase) return;

  const [latestAssignEvent] = await tx
    .select({ actorId: caseEvents.actorId })
    .from(caseEvents)
    .where(
      and(
        eq(caseEvents.caseId, caseId),
        or(
          eq(caseEvents.eventType, "case_assigned"),
          eq(caseEvents.eventType, "case_reassigned")
        )
      )
    )
    .orderBy(desc(caseEvents.occurredAt))
    .limit(1);

  const assigningAdminId = latestAssignEvent?.actorId || targetCase.createdBy;
  if (!assigningAdminId) return;

  // Check recipient is active and not deleted
  const [recipient] = await tx
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.id, assigningAdminId),
        eq(users.isActive, true),
        isNull(users.deletedAt)
      )
    )
    .limit(1);

  if (!recipient) return;

  const now = new Date();
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

  // 2. Check for an existing grouped notification within the last 30 minutes for the same therapist
  const existingGrouped = await tx
    .select()
    .from(inAppNotifications)
    .where(
      and(
        eq(inAppNotifications.userId, recipient.id),
        eq(inAppNotifications.type, "session_completed_group"),
        sql`(${inAppNotifications.data}->>'therapistId') = ${therapistId}`,
        sql`${inAppNotifications.lastGroupedAt} >= ${thirtyMinutesAgo}`
      )
    )
    .orderBy(desc(inAppNotifications.lastGroupedAt))
    .limit(1);

  if (existingGrouped.length > 0) {
    const existing = existingGrouped[0];
    const newCount = (existing.groupedCount || 1) + 1;

    await tx
      .update(inAppNotifications)
      .set({
        groupedCount: newCount,
        title: "Sessions Completed",
        body: `${newCount} sessions completed by ${therapistName}`,
        lastGroupedAt: now,
        isRead: false,
      })
      .where(eq(inAppNotifications.id, existing.id));
  } else {
    // Count held sessions and total sessions for this case
    const [heldRow] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(sessions)
      .where(and(eq(sessions.caseId, caseId), eq(sessions.status, "held")));

    const [totalRow] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(sessions)
      .where(eq(sessions.caseId, caseId));

    const heldCount = heldRow?.count ?? 1;
    const totalCount = totalRow?.count ?? 1;

    await tx.insert(inAppNotifications).values({
      userId: recipient.id,
      type: "session_completed_group",
      title: "Session Completed",
      body: `Session completed: ${targetCase.caseNumber} (session ${heldCount} of ${totalCount}) by ${therapistName}`,
      priority: "low",
      isRead: false,
      caseId,
      branchId: targetCase.branchId || null,
      groupedCount: 1,
      lastGroupedAt: now,
      data: {
        therapistId,
        therapistName,
        caseNumber: targetCase.caseNumber,
        caseId,
        sessionId,
      },
    });
  }
}

export interface NotifyCaseCreatedParams {
  tx: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
  caseId: string;
  patientId: string;
  caseNumber: string;
  therapistName: string;
  branchId?: string | null;
}

/**
 * Notifies all Admins and Super Admins in-app when a therapist creates a case.
 * No email is sent.
 */
export async function notifyCaseCreated({
  tx,
  caseId,
  patientId,
  caseNumber,
  therapistName,
  branchId,
}: NotifyCaseCreatedParams): Promise<void> {
  const recipients = await tx
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        or(eq(users.role, "admin"), eq(users.role, "super_admin")),
        eq(users.isActive, true),
        isNull(users.deletedAt)
      )
    );

  for (const recipient of recipients) {
    await tx.insert(inAppNotifications).values({
      userId: recipient.id,
      type: "case_created",
      title: "New Case Created",
      body: `${therapistName} created case ${patientId}`,
      priority: "normal",
      isRead: false,
      caseId,
      branchId: branchId || null,
      data: {
        patientId,
        caseNumber,
        therapistName,
        caseId,
      },
    });
  }
}

export interface NotifyProgressReportSubmittedParams {
  tx: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
  caseId: string;
  patientId: string;
  caseNumber: string;
  therapistId: string;
  therapistName: string;
  branchId?: string | null;
}

/**
 * Notifies all Admins and Super Admins in-app when a therapist submits a progress report.
 * Grouped if several arrive within 30 minutes for the same therapist.
 * No email is sent. Never contains report text.
 */
export async function notifyProgressReportSubmitted({
  tx,
  caseId,
  patientId,
  caseNumber,
  therapistId,
  therapistName,
  branchId,
}: NotifyProgressReportSubmittedParams): Promise<void> {
  const recipients = await tx
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        or(eq(users.role, "admin"), eq(users.role, "super_admin")),
        eq(users.isActive, true),
        isNull(users.deletedAt)
      )
    );

  const now = new Date();
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

  for (const recipient of recipients) {
    const existingGrouped = await tx
      .select()
      .from(inAppNotifications)
      .where(
        and(
          eq(inAppNotifications.userId, recipient.id),
          eq(inAppNotifications.type, "progress_report_submitted"),
          sql`(${inAppNotifications.data}->>'therapistId') = ${therapistId}`,
          sql`${inAppNotifications.lastGroupedAt} >= ${thirtyMinutesAgo}`
        )
      )
      .orderBy(desc(inAppNotifications.lastGroupedAt))
      .limit(1);

    if (existingGrouped.length > 0) {
      const existing = existingGrouped[0];
      const newCount = (existing.groupedCount || 1) + 1;
      await tx
        .update(inAppNotifications)
        .set({
          groupedCount: newCount,
          title: "Progress Reports Submitted",
          body: `${therapistName} submitted ${newCount} progress reports`,
          lastGroupedAt: now,
          isRead: false,
        })
        .where(eq(inAppNotifications.id, existing.id));
    } else {
      await tx.insert(inAppNotifications).values({
        userId: recipient.id,
        type: "progress_report_submitted",
        title: "Progress Report Submitted",
        body: `${therapistName} submitted a progress report for ${patientId}`,
        priority: "normal",
        isRead: false,
        caseId,
        branchId: branchId || null,
        groupedCount: 1,
        lastGroupedAt: now,
        data: {
          therapistId,
          therapistName,
          patientId,
          caseNumber,
          caseId,
        },
      });
    }
  }
}

