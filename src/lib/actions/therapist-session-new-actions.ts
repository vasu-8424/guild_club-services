"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { cases, sessions, type Session } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { getTodayIST } from "@/lib/date-utils";
import { recordEvent } from "@/lib/events";
import { notifySessionCompleted } from "@/lib/notifications/in-app";
import { saveStorageFile } from "@/lib/storage";

export interface RecordDailySessionInput {
  caseId: string;
  note: string;
  photoBase64?: string;
  photoContentType?: string;
  photoFilename?: string;
}

export interface RecordDailySessionResult {
  success: boolean;
  error?: string;
  session?: {
    id: string;
    sessionDate: string;
    note: string;
    photoKey?: string | null;
  };
}

export async function recordDailySessionAction(
  input: RecordDailySessionInput
): Promise<RecordDailySessionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "therapist") {
    return { success: false, error: "Only therapists can record sessions." };
  }

  const trimmedNote = input.note?.trim();
  if (!trimmedNote || trimmedNote.length < 10) {
    return {
      success: false,
      error: "Session note is required and must be at least 10 characters.",
    };
  }

  const todayIST = getTodayIST();

  // 1. Verify case exists, is active, and owned by this therapist
  const [caseRecord] = await db
    .select({
      id: cases.id,
      currentTherapistId: cases.currentTherapistId,
      status: cases.status,
      startDate: cases.startDate,
      caseNumber: cases.caseNumber,
    })
    .from(cases)
    .where(eq(cases.id, input.caseId))
    .limit(1);

  if (!caseRecord) {
    return { success: false, error: "Case not found." };
  }

  if (caseRecord.currentTherapistId !== currentUser.id) {
    return {
      success: false,
      error: "You are not authorized to record sessions for this case.",
    };
  }

  if (caseRecord.status === "completed") {
    return {
      success: false,
      error: "This case is closed. Sessions cannot be added to closed cases.",
    };
  }

  // 2. Check if a session has already been recorded for today
  const [existingSession] = await db
    .select({ id: sessions.id, sessionDate: sessions.sessionDate })
    .from(sessions)
    .where(
      and(
        eq(sessions.caseId, input.caseId),
        eq(sessions.sessionDate, todayIST)
      )
    )
    .limit(1);

  if (existingSession) {
    return {
      success: false,
      error: "Today's session is already recorded.",
    };
  }

  // 3. Handle optional photo upload
  let savedPhotoKey: string | null = null;
  if (input.photoBase64 && input.photoContentType) {
    let base64Content = input.photoBase64;
    if (base64Content.includes(",")) {
      base64Content = base64Content.split(",")[1];
    }
    const buffer = Buffer.from(base64Content, "base64");

    if (buffer.length > 5 * 1024 * 1024) {
      return { success: false, error: "Photo must be smaller than 5 MB." };
    }

    const ext =
      input.photoContentType === "image/png"
        ? "png"
        : input.photoContentType === "image/webp"
        ? "webp"
        : "jpg";
    const filename = `session_${input.caseId}_${todayIST}_${Date.now()}.${ext}`;
    savedPhotoKey = await saveStorageFile(filename, buffer, input.photoContentType);
  }

  try {
    const result = await db.transaction(async (tx) => {
      // 4. Create the session
      const [newSession] = await tx
        .insert(sessions)
        .values({
          caseId: input.caseId,
          therapistId: currentUser.id,
          sessionDate: todayIST,
          scheduledAt: new Date(),
          recordedAt: new Date(),
          status: "held",
          notes: trimmedNote,
          workDone: trimmedNote,
          photoKey: savedPhotoKey,
        })
        .returning();

      // 5. Record session_recorded audit event
      await recordEvent(tx, {
        eventType: "session_recorded",
        actorId: currentUser.id,
        actorRole: "therapist",
        caseId: input.caseId,
        metadata: {
          sessionId: newSession.id,
          sessionDate: todayIST,
          hasPhoto: Boolean(savedPhotoKey),
        },
      });

      // 6. Send grouped low-priority session notification to Admin
      await notifySessionCompleted({
        tx,
        sessionId: newSession.id,
        caseId: input.caseId,
        therapistId: currentUser.id,
        therapistName: currentUser.name,
      });

      return newSession;
    });

    revalidatePath(`/therapist/cases/${input.caseId}`);
    return {
      success: true,
      session: {
        id: result.id,
        sessionDate: todayIST,
        note: trimmedNote,
        photoKey: savedPhotoKey,
      },
    };
  } catch (err: any) {
    if (err?.code === "23505") {
      // Unique violation
      return { success: false, error: "Today's session is already recorded." };
    }
    console.error("Failed to record session:", err);
    return { success: false, error: "Failed to record session. Please try again." };
  }
}

export async function updateTodaySessionNoteAction(input: {
  caseId: string;
  sessionId: string;
  note: string;
}): Promise<{ success: boolean; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "therapist") {
    return { success: false, error: "Unauthorized" };
  }

  const trimmedNote = input.note?.trim();
  if (!trimmedNote || trimmedNote.length < 10) {
    return {
      success: false,
      error: "Session note must be at least 10 characters.",
    };
  }

  const todayIST = getTodayIST();

  // Verify session belongs to today
  const [session] = await db
    .select({
      id: sessions.id,
      sessionDate: sessions.sessionDate,
      therapistId: sessions.therapistId,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.id, input.sessionId),
        eq(sessions.caseId, input.caseId)
      )
    )
    .limit(1);

  if (!session) {
    return { success: false, error: "Session not found." };
  }

  if (session.therapistId !== currentUser.id) {
    return { success: false, error: "Unauthorized to edit this session." };
  }

  if (session.sessionDate !== todayIST) {
    return {
      success: false,
      error: "Session notes from past days are locked and cannot be edited.",
    };
  }

  await db
    .update(sessions)
    .set({
      notes: trimmedNote,
      workDone: trimmedNote,
    })
    .where(eq(sessions.id, input.sessionId));

  revalidatePath(`/therapist/cases/${input.caseId}`);
  return { success: true };
}
