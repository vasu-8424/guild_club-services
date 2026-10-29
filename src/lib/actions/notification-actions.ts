"use server";

import { db } from "@/db";
import { inAppNotifications, users, cases } from "@/db/schema";
import { eq, and, desc, or, isNull, sql, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { getScope } from "@/lib/scope";
import { revalidatePath } from "next/cache";
import { getEmailProvider, processNotificationQueue } from "@/lib/notifications";

export interface GetNotificationsParams {
  tab?: "all" | "unread" | "closed_cases";
  type?: string;
  outcome?: string;
  page?: number;
  pageSize?: number;
  branchId?: string | null;
}

/**
 * Build a branch-aware WHERE condition for in_app_notifications:
 * - Shows notifications where branchId matches the selected branch OR branchId IS NULL (account-level).
 */
function buildBranchCondition(activeBranchId: string | null) {
  if (!activeBranchId) {
    // No branch selected: show only account-level (null branch) notifications
    return isNull(inAppNotifications.branchId);
  }
  // Show branch-specific + account-level
  return or(
    eq(inAppNotifications.branchId, activeBranchId),
    isNull(inAppNotifications.branchId)
  );
}

export async function getNotificationsAction(params: GetNotificationsParams = {}) {
  const user = await getCurrentUser();
  if (!user || !user.isActive || user.deletedAt !== null) {
    return {
      success: false,
      error: "Authentication required.",
      data: null,
    };
  }

  const {
    tab = "all",
    type,
    outcome,
    page = 1,
    pageSize = 10,
    branchId: paramBranchId,
  } = params;

  // Resolve active branch
  let activeBranchId = paramBranchId !== undefined ? paramBranchId : null;
  if (activeBranchId === undefined) {
    try {
      const scope = await getScope(user);
      activeBranchId = scope.activeBranchId;
    } catch {
      activeBranchId = null;
    }
  }

  // Base security: only user's own notifications
  const conditions = [
    eq(inAppNotifications.userId, user.id),
    buildBranchCondition(activeBranchId)!,
  ];

  if (tab === "unread") {
    conditions.push(eq(inAppNotifications.isRead, false));
  } else if (tab === "closed_cases") {
    conditions.push(eq(inAppNotifications.type, "case_closed"));
  }

  if (type && type !== "all") {
    conditions.push(eq(inAppNotifications.type, type));
  }

  if (outcome && outcome !== "all") {
    conditions.push(
      sql`lower(${inAppNotifications.data}->>'outcome') = ${outcome.toLowerCase()}`
    );
  }

  const whereClause = and(...conditions);
  const offset = (page - 1) * pageSize;

  // Total count matching current filters
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(inAppNotifications)
    .where(whereClause);

  const totalCount = countRow?.count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  // Fetch items
  const items = await db
    .select()
    .from(inAppNotifications)
    .where(whereClause)
    .orderBy(desc(inAppNotifications.createdAt))
    .limit(pageSize)
    .offset(offset);

  // Unread count for branch (branch-specific + account-level)
  const [unreadRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(inAppNotifications)
    .where(
      and(
        eq(inAppNotifications.userId, user.id),
        eq(inAppNotifications.isRead, false),
        buildBranchCondition(activeBranchId)!
      )
    );

  const unreadCount = unreadRow?.count ?? 0;

  return {
    success: true,
    data: {
      items,
      totalCount,
      totalPages,
      page,
      pageSize,
      unreadCount,
    },
  };
}

export async function getLatestNotificationsAction(branchId?: string | null) {
  const user = await getCurrentUser();
  if (!user || !user.isActive || user.deletedAt !== null) {
    return {
      success: false,
      error: "Authentication required.",
      data: { notifications: [], unreadCount: 0 },
    };
  }

  // Resolve active branch
  let activeBranchId = branchId !== undefined ? branchId : null;
  if (branchId === undefined) {
    try {
      const scope = await getScope(user);
      activeBranchId = scope.activeBranchId;
    } catch {
      activeBranchId = null;
    }
  }

  const branchCondition = buildBranchCondition(activeBranchId)!;

  const notifications = await db
    .select()
    .from(inAppNotifications)
    .where(and(eq(inAppNotifications.userId, user.id), branchCondition))
    .orderBy(desc(inAppNotifications.createdAt))
    .limit(5);

  const [unreadRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(inAppNotifications)
    .where(
      and(
        eq(inAppNotifications.userId, user.id),
        eq(inAppNotifications.isRead, false),
        branchCondition
      )
    );

  return {
    success: true,
    data: {
      notifications,
      unreadCount: unreadRow?.count ?? 0,
    },
  };
}

export async function markNotificationReadAction(notificationId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  await db
    .update(inAppNotifications)
    .set({
      isRead: true,
      readAt: new Date(),
    })
    .where(
      and(
        eq(inAppNotifications.id, notificationId),
        eq(inAppNotifications.userId, user.id)
      )
    );

  revalidatePath("/notifications");
  return { success: true };
}

export async function markAllNotificationsReadAction(branchId?: string | null) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  let activeBranchId = branchId !== undefined ? branchId : null;
  if (branchId === undefined) {
    try {
      const scope = await getScope(user);
      activeBranchId = scope.activeBranchId;
    } catch {
      activeBranchId = null;
    }
  }

  const branchCondition = buildBranchCondition(activeBranchId)!;

  await db
    .update(inAppNotifications)
    .set({
      isRead: true,
      readAt: new Date(),
    })
    .where(
      and(
        eq(inAppNotifications.userId, user.id),
        eq(inAppNotifications.isRead, false),
        branchCondition
      )
    );

  revalidatePath("/notifications");
  return { success: true };
}

export async function pollNotificationsAction(params: { since?: string; branchId?: string | null }) {
  const user = await getCurrentUser();
  if (!user || !user.isActive || user.deletedAt !== null) {
    return {
      success: false,
      unreadCount: 0,
      newClosedCases: [],
    };
  }

  let activeBranchId = params.branchId !== undefined ? params.branchId : null;
  if (params.branchId === undefined) {
    try {
      const scope = await getScope(user);
      activeBranchId = scope.activeBranchId;
    } catch {
      activeBranchId = null;
    }
  }

  const branchCondition = buildBranchCondition(activeBranchId)!;

  const [unreadRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(inAppNotifications)
    .where(
      and(
        eq(inAppNotifications.userId, user.id),
        eq(inAppNotifications.isRead, false),
        branchCondition
      )
    );

  const unreadCount = unreadRow?.count ?? 0;

  let newClosedCases: Array<{
    id: string;
    title: string;
    body: string;
    caseId: string | null;
    outcome?: string;
  }> = [];

  if (params.since) {
    const sinceDate = new Date(params.since);
    const newRows = await db
      .select()
      .from(inAppNotifications)
      .where(
        and(
          eq(inAppNotifications.userId, user.id),
          eq(inAppNotifications.type, "case_closed"),
          sql`${inAppNotifications.createdAt} > ${sinceDate}`,
          branchCondition
        )
      )
      .orderBy(desc(inAppNotifications.createdAt))
      .limit(5);

    newClosedCases = newRows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      caseId: r.caseId,
      outcome: (r.data as any)?.outcome,
    }));
  }

  return {
    success: true,
    unreadCount,
    newClosedCases,
    timestamp: new Date().toISOString(),
  };
}

export async function getRecentlyClosedCasesAction(limit = 5, branchId?: string | null) {
  try {
    let activeBranchId = branchId ?? null;
    let therapistIdFilter: string | null = null;
    try {
      const user = await getCurrentUser();
      if (user) {
        if (user.role === "therapist") {
          therapistIdFilter = user.id;
        }
        if (!activeBranchId) {
          try {
            const scope = await getScope(user);
            activeBranchId = scope.activeBranchId;
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // Graceful fallback for non-request environments
    }

    const conditions: any[] = [
      eq(cases.status, "completed"),
      sql`${cases.closedAt} IS NOT NULL`,
    ];

    if (activeBranchId) {
      conditions.push(eq(cases.branchId, activeBranchId));
    }
    if (therapistIdFilter) {
      conditions.push(eq(cases.currentTherapistId, therapistIdFilter));
    }

    const rows = await db
      .select({
        id: cases.id,
        caseNumber: cases.caseNumber,
        outcome: cases.outcome,
        closedAt: cases.closedAt,
        therapistName: users.name,
        therapistId: users.id,
      })
      .from(cases)
      .leftJoin(users, eq(cases.currentTherapistId, users.id))
      .where(and(...conditions))
      .orderBy(desc(cases.closedAt))
      .limit(limit);

    return {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        caseNumber: r.caseNumber,
        outcome: r.outcome ?? "successful",
        closedAt: r.closedAt ? r.closedAt.toISOString() : null,
        closedAtIst: r.closedAt
          ? r.closedAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
          : null,
        therapistName: r.therapistName || "Assigned Practitioner",
      })),
    };
  } catch {
    return { success: false, data: [] };
  }
}

export async function sendTestEmailToMyselfAction(): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const user = await getCurrentUser();
  if (!user || user.role !== "super_admin") {
    return { success: false, error: "Unauthorized. Super Admin only." };
  }

  try {
    const provider = getEmailProvider();
    const result = await provider.send({
      to: user.email,
      toName: user.name,
      subject: "Guild Club Services: Test Email",
      html: "<p>This is a test notification email from Guild Club Services.</p>",
      text: "This is a test notification email from Guild Club Services.",
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error?.message || "Failed to send test email.",
      };
    }

    return {
      success: true,
      messageId: result.providerMessageId || "mock-id",
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to send test email.",
    };
  }
}

export async function retryNotificationsAction(): Promise<{
  success: boolean;
  data?: { processed: number; succeeded: number; failed: number; deferred: number };
  error?: string;
}> {
  const user = await getCurrentUser();
  if (!user || user.role !== "super_admin") {
    return { success: false, error: "Unauthorized. Super Admin only." };
  }

  try {
    const res = await processNotificationQueue(20);
    revalidatePath("/super-admin/notifications");
    return { success: true, data: res };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to process queue.",
    };
  }
}
