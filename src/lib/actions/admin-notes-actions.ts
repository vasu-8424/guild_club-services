"use server";

import { z } from "zod";
import { eq, and, sql, desc, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { adminNotes, users, inAppNotifications } from "@/db/schema";
import { requireRole, getCurrentUser } from "@/lib/session";
import { recordEvent } from "@/lib/events";
import { queueEmail } from "@/lib/email";
import { getEnv } from "@/lib/env";
import { formatDateTimeIST } from "@/lib/date-utils";

export interface AdminNoteItem {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  message: string;
  createdAt: string;
  formattedCreatedAt: string;
  readAt: string | null;
  formattedReadAt: string | null;
  isRead: boolean;
}

const sendNoteSchema = z.object({
  toUserId: z.string().uuid("Invalid recipient ID."),
  message: z
    .string()
    .trim()
    .min(5, "Note must be at least 5 characters.")
    .max(1000, "Note cannot exceed 1,000 characters."),
});

/**
 * Admin / Super Admin sends a plain text note to an active therapist.
 * Rate limit: 20 notes per hour per admin.
 */
export async function sendAdminNoteAction(data: {
  toUserId: string;
  message: string;
}): Promise<{ success: boolean; error?: string; noteId?: string }> {
  try {
    const admin = await requireRole("admin", "super_admin");
    const parsed = sendNoteSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid note data.",
      };
    }

    const { toUserId, message } = parsed.data;

    // 1. Check rate limit: 20 notes per hour per admin
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [recentNotesCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(adminNotes)
      .where(
        and(
          eq(adminNotes.fromUserId, admin.id),
          gte(adminNotes.createdAt, oneHourAgo)
        )
      );

    if ((recentNotesCount?.count ?? 0) >= 20) {
      return {
        success: false,
        error: "Rate limit exceeded. You can send a maximum of 20 notes per hour.",
      };
    }

    // 2. Validate recipient therapist: must exist and be active
    const [therapist] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        isActive: users.isActive,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, toUserId))
      .limit(1);

    if (!therapist || therapist.role !== "therapist") {
      return { success: false, error: "Therapist not found." };
    }

    if (!therapist.isActive) {
      return {
        success: false,
        error: "Cannot send note to a deactivated therapist.",
      };
    }

    // 3. Sanitize message: plain text only (strip any HTML tags)
    const sanitizedMessage = message.replace(/<[^>]*>?/gm, "").trim();
    if (sanitizedMessage.length < 5) {
      return { success: false, error: "Note must be at least 5 characters." };
    }

    const env = getEnv();
    const preview = sanitizedMessage.length > 80
      ? sanitizedMessage.substring(0, 80) + "..."
      : sanitizedMessage;

    const result = await db.transaction(async (tx) => {
      // Insert note into admin_notes
      const [newNote] = await tx
        .insert(adminNotes)
        .values({
          fromUserId: admin.id,
          toUserId: therapist.id,
          message: sanitizedMessage,
        })
        .returning({ id: adminNotes.id, createdAt: adminNotes.createdAt });

      // Record audit event note_sent (do NOT log note text in metadata)
      await recordEvent(tx, {
        eventType: "note_sent",
        actorId: admin.id,
        actorRole: admin.role,
        targetUserId: therapist.id,
        metadata: {
          noteId: newNote.id,
          recipientId: therapist.id,
        },
      });

      // Create in-app notification for the therapist
      await tx.insert(inAppNotifications).values({
        userId: therapist.id,
        type: "admin_note",
        title: `Note from ${admin.name}`,
        body: preview,
        priority: "normal",
        isRead: false,
        data: {
          noteId: newNote.id,
          fromUserId: admin.id,
          fromUserName: admin.name,
        },
      });

      // Queue email if NOTE_EMAIL_ENABLED is true
      if (env.NOTE_EMAIL_ENABLED !== false && therapist.email) {
        await queueEmail(tx as any, {
          toEmail: therapist.email,
          toName: therapist.name,
          template: "admin_note",
          payload: {
            therapistName: therapist.name,
            adminName: admin.name,
            signInUrl: `${env.APP_BASE_URL}/login`,
          },
          priority: 2,
        });
      }

      return newNote;
    });

    revalidatePath(`/admin/therapists/${therapist.id}`);
    revalidatePath("/notifications");

    return { success: true, noteId: result.id };
  } catch (error: any) {
    console.error("sendAdminNoteAction error:", error);
    return {
      success: false,
      error: error?.message || "Failed to send note.",
    };
  }
}

/**
 * Therapist fetches all notes sent to them by admins.
 */
export async function getTherapistNotesAction(): Promise<{
  success: boolean;
  data?: AdminNoteItem[];
  unreadCount?: number;
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user || !user.isActive) {
      return { success: false, error: "Unauthorized" };
    }

    if (user.role !== "therapist") {
      return { success: false, error: "Forbidden: Therapists only." };
    }

    const rows = await db
      .select({
        id: adminNotes.id,
        fromUserId: adminNotes.fromUserId,
        fromUserName: users.name,
        toUserId: adminNotes.toUserId,
        message: adminNotes.message,
        createdAt: adminNotes.createdAt,
        readAt: adminNotes.readAt,
      })
      .from(adminNotes)
      .innerJoin(users, eq(adminNotes.fromUserId, users.id))
      .where(eq(adminNotes.toUserId, user.id))
      .orderBy(desc(adminNotes.createdAt));

    let unreadCount = 0;
    const items: AdminNoteItem[] = rows.map((r) => {
      if (!r.readAt) unreadCount++;
      return {
        id: r.id,
        fromUserId: r.fromUserId,
        fromUserName: r.fromUserName || "Administrator",
        toUserId: r.toUserId,
        toUserName: user.name,
        message: r.message,
        createdAt: r.createdAt.toISOString(),
        formattedCreatedAt: formatDateTimeIST(r.createdAt),
        readAt: r.readAt ? r.readAt.toISOString() : null,
        formattedReadAt: r.readAt ? formatDateTimeIST(r.readAt) : null,
        isRead: Boolean(r.readAt),
      };
    });

    return { success: true, data: items, unreadCount };
  } catch (error: any) {
    console.error("getTherapistNotesAction error:", error);
    return { success: false, error: error?.message || "Failed to fetch notes." };
  }
}

/**
 * Mark a note as read by the recipient therapist.
 */
export async function markNoteReadAction(noteId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user || !user.isActive) {
      return { success: false, error: "Unauthorized" };
    }

    const [note] = await db
      .select()
      .from(adminNotes)
      .where(and(eq(adminNotes.id, noteId), eq(adminNotes.toUserId, user.id)))
      .limit(1);

    if (!note) {
      return { success: false, error: "Note not found." };
    }

    if (!note.readAt) {
      const now = new Date();
      await db
        .update(adminNotes)
        .set({ readAt: now })
        .where(eq(adminNotes.id, note.id));

      // Also mark matching in-app notification as read
      await db
        .update(inAppNotifications)
        .set({ isRead: true, readAt: now })
        .where(
          and(
            eq(inAppNotifications.userId, user.id),
            eq(inAppNotifications.type, "admin_note"),
            sql`(${inAppNotifications.data}->>'noteId') = ${note.id}`
          )
        );
    }

    revalidatePath("/therapist/notes");
    revalidatePath("/notifications");

    return { success: true };
  } catch (error: any) {
    console.error("markNoteReadAction error:", error);
    return { success: false, error: error?.message || "Failed to mark note as read." };
  }
}

/**
 * Fetch notes sent by admin to a specific therapist (for Admin therapist detail page).
 */
export async function getAdminSentNotesAction(therapistId: string): Promise<{
  success: boolean;
  data?: AdminNoteItem[];
  error?: string;
}> {
  try {
    const user = await requireRole("admin", "super_admin");
    if (!user) return { success: false, error: "Unauthorized" };

    const rows = await db
      .select({
        id: adminNotes.id,
        fromUserId: adminNotes.fromUserId,
        fromUserName: users.name,
        toUserId: adminNotes.toUserId,
        message: adminNotes.message,
        createdAt: adminNotes.createdAt,
        readAt: adminNotes.readAt,
      })
      .from(adminNotes)
      .innerJoin(users, eq(adminNotes.fromUserId, users.id))
      .where(eq(adminNotes.toUserId, therapistId))
      .orderBy(desc(adminNotes.createdAt));

    const items: AdminNoteItem[] = rows.map((r) => ({
      id: r.id,
      fromUserId: r.fromUserId,
      fromUserName: r.fromUserName || "Administrator",
      toUserId: r.toUserId,
      toUserName: "Therapist",
      message: r.message,
      createdAt: r.createdAt.toISOString(),
      formattedCreatedAt: formatDateTimeIST(r.createdAt),
      readAt: r.readAt ? r.readAt.toISOString() : null,
      formattedReadAt: r.readAt ? formatDateTimeIST(r.readAt) : null,
      isRead: Boolean(r.readAt),
    }));

    return { success: true, data: items };
  } catch (error: any) {
    console.error("getAdminSentNotesAction error:", error);
    return { success: false, error: error?.message || "Failed to fetch notes." };
  }
}
