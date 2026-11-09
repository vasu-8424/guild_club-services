"use server";

import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  cases,
  clients,
  caseEvents,
  inAppNotifications,
  sessionReasonMessages,
  sessionReasonThreads,
  sessions,
  users,
} from "@/db/schema";
import { getCurrentUser, requireRole } from "@/lib/session";
import { getTodayIST, formatDateTimeIST } from "@/lib/date-utils";
import { getScope } from "@/lib/scope";
import { recordEvent } from "@/lib/events";

// -----------------------------------------------------------------------------
// Validation Schemas
// -----------------------------------------------------------------------------

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>?/gm, "").trim();
}

const reasonMessageSchema = z.object({
  body: z
    .string()
    .transform((val) => stripHtml(val))
    .pipe(
      z
        .string()
        .min(1, "Reason text must be at least 1 character.")
        .max(1000, "Reason text cannot exceed 1,000 characters.")
    ),
});

export interface ThreadMessageView {
  id: string;
  authorId: string;
  authorRole: "therapist" | "admin";
  authorName: string;
  body: string;
  createdAt: string; // ISO
  formattedTimeIST: string;
  readByRecipientAt: string | null;
  isRead: boolean;
  isMine: boolean;
  isEdited: boolean;
  editedAt: string | null;
}

export interface ThreadDetailsView {
  id: string;
  caseId: string;
  patientId: string;
  clientName: string;
  branchId: string;
  therapistId: string;
  therapistName: string;
  threadDate: string;
  status: "open" | "resolved";
  isSessionRecordedToday: boolean;
  isLockedMidnight: boolean;
  canSend: boolean;
  canEditLast: boolean;
  unreadCountForMe: number;
  messages: ThreadMessageView[];
}

export interface AdminReasonInboxItem {
  threadId: string;
  caseId: string;
  patientId: string;
  patientName: string;
  therapistName: string;
  firstLine: string;
  timeIST: string;
  hasUnread: boolean;
  unreadCount: number;
  status: "open" | "resolved";
  updatedAt: string;
}

// -----------------------------------------------------------------------------
// 1. Get Thread for Case on Today (or Date)
// -----------------------------------------------------------------------------

export async function getThreadForCaseTodayAction(
  caseId: string,
  targetDate?: string
): Promise<{ success: boolean; data?: ThreadDetailsView | null; error?: string }> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.isActive) {
      return { success: false, error: "Unauthorized" };
    }

    const todayIST = getTodayIST();
    const dateToCheck = targetDate || todayIST;
    const isPastDate = dateToCheck < todayIST;

    // 1. Fetch case with branch verification
    const [caseRecord] = await db
      .select({
        id: cases.id,
        patientId: cases.patientId,
        caseNumber: cases.caseNumber,
        clientName: clients.fullName,
        branchId: cases.branchId,
        currentTherapistId: cases.currentTherapistId,
        createdBy: cases.createdBy,
      })
      .from(cases)
      .innerJoin(clients, eq(cases.clientId, clients.id))
      .where(eq(cases.id, caseId))
      .limit(1);

    if (!caseRecord) {
      return { success: false, error: "Not found" };
    }

    // Branch scoping
    const scope = await getScope(currentUser);
    if (!scope.canAccessBranch(caseRecord.branchId)) {
      return { success: false, error: "Not found" };
    }

    // Role check: therapist can only see their own cases
    if (currentUser.role === "therapist") {
      const isOwner =
        caseRecord.currentTherapistId === currentUser.id ||
        caseRecord.createdBy === currentUser.id;
      if (!isOwner) {
        return { success: false, error: "Not found" };
      }
    }

    // 2. Check if a session has been recorded for this case today
    const [todaySession] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(sessions.caseId, caseId),
          eq(sessions.sessionDate, dateToCheck)
        )
      )
      .limit(1);

    const isSessionRecordedToday = Boolean(todaySession);

    // 3. Find reason thread for (caseId, dateToCheck)
    const [thread] = await db
      .select({
        id: sessionReasonThreads.id,
        status: sessionReasonThreads.status,
        therapistId: sessionReasonThreads.therapistId,
        adminId: sessionReasonThreads.adminId,
        threadDate: sessionReasonThreads.threadDate,
        branchId: sessionReasonThreads.branchId,
      })
      .from(sessionReasonThreads)
      .where(
        and(
          eq(sessionReasonThreads.caseId, caseId),
          eq(sessionReasonThreads.threadDate, dateToCheck)
        )
      )
      .limit(1);

    if (!thread) {
      return {
        success: true,
        data: {
          id: "",
          caseId: caseRecord.id,
          patientId: caseRecord.patientId || caseRecord.caseNumber,
          clientName: caseRecord.clientName,
          branchId: caseRecord.branchId,
          therapistId: caseRecord.currentTherapistId || caseRecord.createdBy,
          therapistName: currentUser.name,
          threadDate: dateToCheck,
          status: "open",
          isSessionRecordedToday,
          isLockedMidnight: isPastDate,
          canSend: !isSessionRecordedToday && !isPastDate,
          canEditLast: false,
          unreadCountForMe: 0,
          messages: [],
        },
      };
    }

    // 4. Fetch therapist name
    const [therapistUser] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, thread.therapistId))
      .limit(1);

    // 5. Fetch all messages in thread
    const messageRows = await db
      .select({
        id: sessionReasonMessages.id,
        authorId: sessionReasonMessages.authorId,
        authorRole: sessionReasonMessages.authorRole,
        authorName: users.name,
        body: sessionReasonMessages.body,
        isEdited: sessionReasonMessages.isEdited,
        editedAt: sessionReasonMessages.editedAt,
        createdAt: sessionReasonMessages.createdAt,
        readByRecipientAt: sessionReasonMessages.readByRecipientAt,
      })
      .from(sessionReasonMessages)
      .innerJoin(users, eq(users.id, sessionReasonMessages.authorId))
      .where(eq(sessionReasonMessages.threadId, thread.id))
      .orderBy(sessionReasonMessages.createdAt);

    let unreadCountForMe = 0;
    const formattedMessages: ThreadMessageView[] = messageRows.map((m) => {
      const isMine = m.authorId === currentUser.id;
      const isRead = m.readByRecipientAt !== null;
      if (!isMine && !isRead) {
        unreadCountForMe++;
      }
      return {
        id: m.id,
        authorId: m.authorId,
        authorRole: m.authorRole,
        authorName: m.authorName,
        body: m.body,
        isEdited: m.isEdited,
        editedAt: m.editedAt?.toISOString() || null,
        createdAt: m.createdAt.toISOString(),
        formattedTimeIST: formatDateTimeIST(m.createdAt),
        readByRecipientAt: m.readByRecipientAt?.toISOString() || null,
        isRead,
        isMine,
      };
    });

    const isLockedMidnight = isPastDate;
    const isResolved = thread.status === "resolved";
    const canSend = !isSessionRecordedToday && !isLockedMidnight && !isResolved;

    const lastMsg = formattedMessages[formattedMessages.length - 1];
    const canEditLast =
      canSend &&
      Boolean(lastMsg && lastMsg.isMine && currentUser.role === "therapist");

    return {
      success: true,
      data: {
        id: thread.id,
        caseId: caseRecord.id,
        patientId: caseRecord.patientId || caseRecord.caseNumber,
        clientName: caseRecord.clientName,
        branchId: caseRecord.branchId,
        therapistId: thread.therapistId,
        therapistName: therapistUser?.name || "Clinician",
        threadDate: thread.threadDate,
        status: thread.status,
        isSessionRecordedToday,
        isLockedMidnight,
        canSend,
        canEditLast,
        unreadCountForMe,
        messages: formattedMessages,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to load thread." };
  }
}

// -----------------------------------------------------------------------------
// 2. Submit Reason Message (Therapist)
// -----------------------------------------------------------------------------

export async function submitReasonMessageAction(input: {
  caseId: string;
  body: string;
}): Promise<{ success: boolean; threadId?: string; messageId?: string; error?: string }> {
  try {
    const user = await requireRole("therapist");
    const parsed = reasonMessageSchema.safeParse({ body: input.body });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Invalid reason text." };
    }
    const cleanBody = parsed.data.body;

    const todayIST = getTodayIST();

    // 1. Check Case ownership and branch
    const [caseRecord] = await db
      .select({
        id: cases.id,
        patientId: cases.patientId,
        caseNumber: cases.caseNumber,
        branchId: cases.branchId,
        currentTherapistId: cases.currentTherapistId,
        createdBy: cases.createdBy,
      })
      .from(cases)
      .where(eq(cases.id, input.caseId))
      .limit(1);

    if (!caseRecord) {
      return { success: false, error: "Not found" };
    }

    const scope = await getScope(user);
    if (!scope.canAccessBranch(caseRecord.branchId)) {
      return { success: false, error: "Not found" };
    }

    const isOwner =
      caseRecord.currentTherapistId === user.id ||
      caseRecord.createdBy === user.id;
    if (!isOwner) {
      return { success: false, error: "Not found" };
    }

    // 2. Rule: Blocked when session is recorded today
    const [existingSession] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(sessions.caseId, input.caseId),
          eq(sessions.sessionDate, todayIST)
        )
      )
      .limit(1);

    if (existingSession) {
      return { success: false, error: "Session recorded today" };
    }

    // 3. Rate Limit: 10 messages per therapist per hour
    const [hourCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sessionReasonMessages)
      .where(
        and(
          eq(sessionReasonMessages.authorId, user.id),
          sql`${sessionReasonMessages.createdAt} >= (now() - interval '1 hour')`
        )
      );

    if ((hourCount?.count ?? 0) >= 10) {
      return {
        success: false,
        error: "Rate limit reached: Maximum 10 reason messages per hour.",
      };
    }

    // 4. Find or create today's thread
    const [existingThread] = await db
      .select()
      .from(sessionReasonThreads)
      .where(
        and(
          eq(sessionReasonThreads.caseId, input.caseId),
          eq(sessionReasonThreads.threadDate, todayIST)
        )
      )
      .limit(1);

    if (existingThread && existingThread.status === "resolved") {
      return {
        success: false,
        error: "This thread is resolved. Ask administrator to reopen it.",
      };
    }

    let threadId = existingThread?.id;

    const result = await db.transaction(async (tx) => {
      if (!threadId) {
        // Find assigning admin
        const [latestAssignEvent] = await tx
          .select({ actorId: caseEvents.actorId })
          .from(caseEvents)
          .where(
            and(
              eq(caseEvents.caseId, input.caseId),
              sql`${caseEvents.eventType} IN ('case_assigned', 'case_reassigned')`
            )
          )
          .orderBy(desc(caseEvents.occurredAt))
          .limit(1);

        const adminId = latestAssignEvent?.actorId || caseRecord.createdBy;

        const [newThread] = await tx
          .insert(sessionReasonThreads)
          .values({
            caseId: input.caseId,
            branchId: caseRecord.branchId,
            therapistId: user.id,
            adminId,
            threadDate: todayIST,
            status: "open",
          })
          .returning();

        threadId = newThread.id;
      } else {
        await tx
          .update(sessionReasonThreads)
          .set({ updatedAt: new Date() })
          .where(eq(sessionReasonThreads.id, threadId));
      }

      // Insert message
      const [newMsg] = await tx
        .insert(sessionReasonMessages)
        .values({
          threadId,
          branchId: caseRecord.branchId,
          authorId: user.id,
          authorRole: "therapist",
          body: cleanBody,
        })
        .returning();

      // Audit Event: NEVER include message body in logs or metadata
      await recordEvent(tx, {
        eventType: "session_reason_submitted",
        actorId: user.id,
        actorRole: "therapist",
        caseId: input.caseId,
        metadata: {
          threadId,
          messageId: newMsg.id,
          threadDate: todayIST,
        },
      });

      // 5. In-App Notification to Assigning Admin (Grouped within 30 min)
      const targetAdminId = existingThread?.adminId || caseRecord.createdBy;
      if (targetAdminId) {
        const preview = cleanBody.slice(0, 80);
        const pId = caseRecord.patientId || caseRecord.caseNumber;
        const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

        const [existingNotif] = await tx
          .select()
          .from(inAppNotifications)
          .where(
            and(
              eq(inAppNotifications.userId, targetAdminId),
              eq(inAppNotifications.type, "session_reason"),
              eq(inAppNotifications.isRead, false),
              sql`${inAppNotifications.lastGroupedAt} >= ${thirtyMinAgo}`
            )
          )
          .limit(1);

        if (existingNotif) {
          const newCount = existingNotif.groupedCount + 1;
          await tx
            .update(inAppNotifications)
            .set({
              groupedCount: newCount,
              title: `${newCount} reasons from ${user.name} today`,
              body: preview,
              lastGroupedAt: new Date(),
            })
            .where(eq(inAppNotifications.id, existingNotif.id));
        } else {
          await tx.insert(inAppNotifications).values({
            userId: targetAdminId,
            type: "session_reason",
            title: `Reason for ${pId} today`,
            body: preview,
            priority: "normal",
            branchId: caseRecord.branchId,
            caseId: input.caseId,
            groupedCount: 1,
            data: { threadId, caseId: input.caseId },
          });
        }
      }

      return { threadId, messageId: newMsg.id };
    });

    revalidatePath("/therapist/dashboard");
    revalidatePath("/admin/dashboard");
    return { success: true, ...result };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to submit reason." };
  }
}

// -----------------------------------------------------------------------------
// 3. Edit Last Reason Message (Therapist before midnight)
// -----------------------------------------------------------------------------

export async function editLastReasonMessageAction(input: {
  messageId: string;
  body: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireRole("therapist");
    const parsed = reasonMessageSchema.safeParse({ body: input.body });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Invalid reason text." };
    }
    const cleanBody = parsed.data.body;
    const todayIST = getTodayIST();

    // 1. Fetch message and thread
    const [msg] = await db
      .select({
        id: sessionReasonMessages.id,
        threadId: sessionReasonMessages.threadId,
        authorId: sessionReasonMessages.authorId,
        body: sessionReasonMessages.body,
        originalBody: sessionReasonMessages.originalBody,
        readByRecipientAt: sessionReasonMessages.readByRecipientAt,
        createdAt: sessionReasonMessages.createdAt,
        threadDate: sessionReasonThreads.threadDate,
        threadStatus: sessionReasonThreads.status,
        caseId: sessionReasonThreads.caseId,
        branchId: sessionReasonThreads.branchId,
      })
      .from(sessionReasonMessages)
      .innerJoin(
        sessionReasonThreads,
        eq(sessionReasonThreads.id, sessionReasonMessages.threadId)
      )
      .where(eq(sessionReasonMessages.id, input.messageId))
      .limit(1);

    if (!msg) {
      return { success: false, error: "Not found" };
    }

    if (msg.authorId !== user.id) {
      return { success: false, error: "Not authorized to edit this message." };
    }

    // 2. Midnight lock check
    if (msg.threadDate !== todayIST) {
      return { success: false, error: "Past midnight IST. Locked." };
    }

    if (msg.threadStatus === "resolved") {
      return { success: false, error: "Thread is resolved and cannot be edited." };
    }

    // 3. Verify session not recorded today
    const [existingSession] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(sessions.caseId, msg.caseId),
          eq(sessions.sessionDate, todayIST)
        )
      )
      .limit(1);

    if (existingSession) {
      return { success: false, error: "Session recorded today" };
    }

    // 4. Verify this is indeed the latest message in this thread
    const [latestMsg] = await db
      .select({ id: sessionReasonMessages.id })
      .from(sessionReasonMessages)
      .where(eq(sessionReasonMessages.threadId, msg.threadId))
      .orderBy(desc(sessionReasonMessages.createdAt))
      .limit(1);

    if (latestMsg?.id !== msg.id) {
      return { success: false, error: "Only your latest message can be edited." };
    }

    await db.transaction(async (tx) => {
      const originalText = msg.originalBody || msg.body;
      const wasReadByAdmin = msg.readByRecipientAt !== null;

      await tx
        .update(sessionReasonMessages)
        .set({
          body: cleanBody,
          originalBody: originalText,
          isEdited: true,
          editedAt: new Date(),
          // If already read by admin, reset readByRecipientAt so admin sees the updated reason
          ...(wasReadByAdmin ? { readByRecipientAt: null } : {}),
        })
        .where(eq(sessionReasonMessages.id, msg.id));

      await tx
        .update(sessionReasonThreads)
        .set({ updatedAt: new Date() })
        .where(eq(sessionReasonThreads.id, msg.threadId));

      await recordEvent(tx, {
        eventType: "session_reason_edited",
        actorId: user.id,
        actorRole: "therapist",
        caseId: msg.caseId,
        metadata: {
          threadId: msg.threadId,
          messageId: msg.id,
          wasReadByAdmin,
        },
      });
    });

    revalidatePath("/therapist/dashboard");
    revalidatePath("/admin/dashboard");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to edit reason." };
  }
}

// -----------------------------------------------------------------------------
// 4. Reply to Reason Thread (Admin / Super Admin)
// -----------------------------------------------------------------------------

export async function replyReasonMessageAction(input: {
  threadId: string;
  body: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const user = await requireRole("admin", "super_admin");
    const parsed = reasonMessageSchema.safeParse({ body: input.body });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Invalid reply text." };
    }
    const cleanBody = parsed.data.body;
    const todayIST = getTodayIST();

    // 1. Fetch thread
    const [thread] = await db
      .select({
        id: sessionReasonThreads.id,
        caseId: sessionReasonThreads.caseId,
        branchId: sessionReasonThreads.branchId,
        therapistId: sessionReasonThreads.therapistId,
        threadDate: sessionReasonThreads.threadDate,
        status: sessionReasonThreads.status,
      })
      .from(sessionReasonThreads)
      .where(eq(sessionReasonThreads.id, input.threadId))
      .limit(1);

    if (!thread) {
      return { success: false, error: "Not found" };
    }

    const scope = await getScope(user);
    if (!scope.canAccessBranch(thread.branchId)) {
      return { success: false, error: "Not found" };
    }

    // 2. Midnight rule: past threads are read-only
    if (thread.threadDate !== todayIST) {
      return { success: false, error: "Past midnight IST. Thread is read-only." };
    }

    if (thread.status === "resolved") {
      return { success: false, error: "Thread is marked resolved. Reopen before replying." };
    }

    // 3. Rate Limit: 30 replies per admin per hour
    const [hourCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sessionReasonMessages)
      .where(
        and(
          eq(sessionReasonMessages.authorId, user.id),
          sql`${sessionReasonMessages.createdAt} >= (now() - interval '1 hour')`
        )
      );

    if ((hourCount?.count ?? 0) >= 30) {
      return {
        success: false,
        error: "Rate limit reached: Maximum 30 replies per hour.",
      };
    }

    // 4. Fetch case info for notification title
    const [caseRecord] = await db
      .select({
        patientId: cases.patientId,
        caseNumber: cases.caseNumber,
      })
      .from(cases)
      .where(eq(cases.id, thread.caseId))
      .limit(1);

    const pId = caseRecord?.patientId || caseRecord?.caseNumber || "Patient";

    const result = await db.transaction(async (tx) => {
      const [newMsg] = await tx
        .insert(sessionReasonMessages)
        .values({
          threadId: thread.id,
          branchId: thread.branchId,
          authorId: user.id,
          authorRole: "admin",
          body: cleanBody,
        })
        .returning();

      await tx
        .update(sessionReasonThreads)
        .set({ updatedAt: new Date(), adminId: user.id })
        .where(eq(sessionReasonThreads.id, thread.id));

      await recordEvent(tx, {
        eventType: "session_reason_replied",
        actorId: user.id,
        actorRole: user.role,
        caseId: thread.caseId,
        metadata: {
          threadId: thread.id,
          messageId: newMsg.id,
        },
      });

      // In-app notification to therapist
      await tx.insert(inAppNotifications).values({
        userId: thread.therapistId,
        type: "session_reason_reply",
        title: `Reply from Admin on ${pId}`,
        body: cleanBody.slice(0, 80),
        priority: "normal",
        branchId: thread.branchId,
        caseId: thread.caseId,
        groupedCount: 1,
        data: { threadId: thread.id, caseId: thread.caseId },
      });

      return newMsg;
    });

    revalidatePath("/therapist/dashboard");
    revalidatePath("/admin/dashboard");
    return { success: true, messageId: result.id };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to send reply." };
  }
}

// -----------------------------------------------------------------------------
// 5. Mark Thread Resolved / Reopen (Admin)
// -----------------------------------------------------------------------------

export async function markThreadResolvedAction(input: {
  threadId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireRole("admin", "super_admin");
    const [thread] = await db
      .select({
        id: sessionReasonThreads.id,
        branchId: sessionReasonThreads.branchId,
      })
      .from(sessionReasonThreads)
      .where(eq(sessionReasonThreads.id, input.threadId))
      .limit(1);

    if (!thread) {
      return { success: false, error: "Not found" };
    }

    const scope = await getScope(user);
    if (!scope.canAccessBranch(thread.branchId)) {
      return { success: false, error: "Not found" };
    }

    await db
      .update(sessionReasonThreads)
      .set({ status: "resolved", updatedAt: new Date() })
      .where(eq(sessionReasonThreads.id, input.threadId));

    revalidatePath("/admin/dashboard");
    revalidatePath("/therapist/dashboard");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to resolve thread." };
  }
}

export async function reopenThreadAction(input: {
  threadId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireRole("admin", "super_admin");
    const [thread] = await db
      .select({
        id: sessionReasonThreads.id,
        branchId: sessionReasonThreads.branchId,
        threadDate: sessionReasonThreads.threadDate,
      })
      .from(sessionReasonThreads)
      .where(eq(sessionReasonThreads.id, input.threadId))
      .limit(1);

    if (!thread) {
      return { success: false, error: "Not found" };
    }

    const scope = await getScope(user);
    if (!scope.canAccessBranch(thread.branchId)) {
      return { success: false, error: "Not found" };
    }

    const todayIST = getTodayIST();
    if (thread.threadDate !== todayIST) {
      return { success: false, error: "Past midnight IST. Locked and cannot be reopened." };
    }

    await db
      .update(sessionReasonThreads)
      .set({ status: "open", updatedAt: new Date() })
      .where(eq(sessionReasonThreads.id, input.threadId));

    revalidatePath("/admin/dashboard");
    revalidatePath("/therapist/dashboard");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to reopen thread." };
  }
}

// -----------------------------------------------------------------------------
// 6. Mark Messages Read
// -----------------------------------------------------------------------------

export async function markThreadReadAction(input: {
  threadId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Unauthorized" };

    const [thread] = await db
      .select({
        id: sessionReasonThreads.id,
        branchId: sessionReasonThreads.branchId,
        caseId: sessionReasonThreads.caseId,
      })
      .from(sessionReasonThreads)
      .where(eq(sessionReasonThreads.id, input.threadId))
      .limit(1);

    if (!thread) return { success: false, error: "Not found" };

    const scope = await getScope(currentUser);
    if (!scope.canAccessBranch(thread.branchId)) {
      return { success: false, error: "Not found" };
    }

    // Mark messages where authorId != currentUser.id as read
    await db.transaction(async (tx) => {
      await tx
        .update(sessionReasonMessages)
        .set({ readByRecipientAt: new Date() })
        .where(
          and(
            eq(sessionReasonMessages.threadId, input.threadId),
            ne(sessionReasonMessages.authorId, currentUser.id),
            isNull(sessionReasonMessages.readByRecipientAt)
          )
        );

      await recordEvent(tx, {
        eventType: "session_reason_read",
        actorId: currentUser.id,
        actorRole: currentUser.role,
        caseId: thread.caseId,
        metadata: { threadId: thread.id },
      });
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to mark read." };
  }
}

// -----------------------------------------------------------------------------
// 7. Admin Reason Inbox Query
// -----------------------------------------------------------------------------

export async function getAdminReasonInboxAction(filter?: {
  date?: string;
  branchId?: string;
}): Promise<{
  success: boolean;
  threads: AdminReasonInboxItem[];
  openCount: number;
  error?: string;
}> {
  try {
    const user = await requireRole("admin", "super_admin");
    const scope = await getScope(user);

    const targetDate = filter?.date || getTodayIST();
    let targetBranchId = filter?.branchId || scope.activeBranchId;

    if (!targetBranchId && scope.allowedBranchIds.length === 1) {
      targetBranchId = scope.allowedBranchIds[0];
    }

    if (targetBranchId && !scope.canAccessBranch(targetBranchId)) {
      return { success: false, threads: [], openCount: 0, error: "Not found" };
    }

    // Query threads for this date and branch
    const whereConditions = [eq(sessionReasonThreads.threadDate, targetDate)];
    if (targetBranchId) {
      whereConditions.push(eq(sessionReasonThreads.branchId, targetBranchId));
    } else if (scope.allowedBranchIds.length > 0) {
      whereConditions.push(
        inArray(sessionReasonThreads.branchId, scope.allowedBranchIds)
      );
    }

    const threadsRows = await db
      .select({
        threadId: sessionReasonThreads.id,
        caseId: sessionReasonThreads.caseId,
        patientId: cases.patientId,
        caseNumber: cases.caseNumber,
        patientName: clients.fullName,
        therapistName: users.name,
        status: sessionReasonThreads.status,
        updatedAt: sessionReasonThreads.updatedAt,
      })
      .from(sessionReasonThreads)
      .innerJoin(cases, eq(cases.id, sessionReasonThreads.caseId))
      .innerJoin(clients, eq(cases.clientId, clients.id))
      .innerJoin(users, eq(users.id, sessionReasonThreads.therapistId))
      .where(and(...whereConditions))
      .orderBy(desc(sessionReasonThreads.updatedAt));

    if (threadsRows.length === 0) {
      return { success: true, threads: [], openCount: 0 };
    }

    let openCount = 0;
    const inboxItems: AdminReasonInboxItem[] = [];

    for (const t of threadsRows) {
      if (t.status === "open") openCount++;

      // Fetch first message for preview and latest message time
      const messages = await db
        .select({
          body: sessionReasonMessages.body,
          createdAt: sessionReasonMessages.createdAt,
          authorRole: sessionReasonMessages.authorRole,
          readByRecipientAt: sessionReasonMessages.readByRecipientAt,
        })
        .from(sessionReasonMessages)
        .where(eq(sessionReasonMessages.threadId, t.threadId))
        .orderBy(sessionReasonMessages.createdAt);

      const firstMsg = messages[0];
      const latestMsg = messages[messages.length - 1];

      // Unread: any message from therapist where readByRecipientAt is null
      const unreadFromTherapist = messages.filter(
        (m) => m.authorRole === "therapist" && m.readByRecipientAt === null
      );

      const hasUnread = unreadFromTherapist.length > 0;
      const firstLine = firstMsg ? firstMsg.body.split("\n")[0].trim() : "—";
      const timeIST = latestMsg ? formatDateTimeIST(latestMsg.createdAt) : "—";

      inboxItems.push({
        threadId: t.threadId,
        caseId: t.caseId,
        patientId: t.patientId || t.caseNumber,
        patientName: t.patientName,
        therapistName: t.therapistName,
        firstLine,
        timeIST,
        hasUnread,
        unreadCount: unreadFromTherapist.length,
        status: t.status,
        updatedAt: t.updatedAt.toISOString(),
      });
    }

    // Sort: Unread first, then latest updated
    inboxItems.sort((a, b) => {
      if (a.hasUnread !== b.hasUnread) {
        return a.hasUnread ? -1 : 1;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return {
      success: true,
      threads: inboxItems,
      openCount,
    };
  } catch (err: any) {
    return { success: false, threads: [], openCount: 0, error: err?.message || "Failed to load inbox." };
  }
}
