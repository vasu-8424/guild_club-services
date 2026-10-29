"use server";

import { and, eq, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { cases, sessions, type Session } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { getTodayIST } from "@/lib/date-utils";
import { getScope } from "@/lib/scope";
import { recordEvent } from "@/lib/events";
import { notifySessionCompleted } from "@/lib/notifications/in-app";
import { saveStorageFile } from "@/lib/storage";

const dailySessionSchema = z.object({
  caseId: z.string().uuid("Invalid Case ID"),
  note: z.string().trim().min(10, "Session note must be at least 10 characters"),
  presentCondition: z
    .string()
    .trim()
    .min(10, "Present condition today must be at least 10 characters"),
  signatureBase64: z.string().min(1, "Patient signature is required"),
});

export interface RecordDailySessionInput {
  caseId: string;
  note: string;
  presentCondition?: string;
  signatureBase64?: string;
  // Optional photo support
  photoBase64?: string;
  photoContentType?: string;
  photoFilename?: string;
}

export interface RecordDailySessionResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  session?: {
    id: string;
    sessionDate: string;
    note: string;
    presentConditionSnapshot?: string | null;
    signatureKey?: string | null;
    photoKey?: string | null;
  };
}

/**
 * Server Action to record today's clinical session.
 * Requires 3 items saved on the server:
 *  1. Present condition today (min 10 chars)
 *  2. Session note (min 10 chars)
 *  3. Patient signature (PNG under 500 KB)
 * Only 1 session per case per IST day is permitted.
 */
export async function recordDailySessionAction(
  input: RecordDailySessionInput
): Promise<RecordDailySessionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "therapist") {
    return { success: false, error: "Only therapists can record sessions." };
  }

  // Zod validation on inputs
  const parsed = dailySessionSchema.safeParse({
    caseId: input.caseId,
    note: input.note,
    presentCondition: input.presentCondition ?? "",
    signatureBase64: input.signatureBase64 ?? "",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    parsed.error.issues.forEach((err) => {
      const field = String(err.path[0] || "form");
      fieldErrors[field] = err.message;
    });
    const firstMsg = parsed.error.issues[0]?.message || "All three items (condition, note, signature) are required.";
    return {
      success: false,
      error: firstMsg,
      fieldErrors,
    };
  }

  const { note, presentCondition, signatureBase64 } = parsed.data;
  const todayIST = getTodayIST();

  // 1. Verify case exists, belongs to this therapist, and is in selected branch
  const [caseRecord] = await db
    .select({
      id: cases.id,
      currentTherapistId: cases.currentTherapistId,
      createdBy: cases.createdBy,
      branchId: cases.branchId,
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

  const isOwner =
    caseRecord.currentTherapistId === currentUser.id ||
    caseRecord.createdBy === currentUser.id;

  if (!isOwner) {
    return {
      success: false,
      error: "You are not authorized to record sessions for this case.",
    };
  }

  const scope = await getScope(currentUser);
  if (!scope.canAccessBranch(caseRecord.branchId)) {
    return {
      success: false,
      error: "You are not authorized in this branch.",
    };
  }

  if (
    (caseRecord.status as string) === "completed" ||
    (caseRecord.status as string) === "closed"
  ) {
    return {
      success: false,
      error: "This case is closed. Sessions cannot be added to closed cases.",
    };
  }

  // 2. Check if a session has already been recorded for today (strict IST day check)
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

  // 3. Process patient signature (must be PNG < 500 KB)
  let signatureBuffer: Buffer;
  try {
    let cleanSig = signatureBase64;
    if (cleanSig.includes(",")) {
      cleanSig = cleanSig.split(",")[1];
    }
    signatureBuffer = Buffer.from(cleanSig, "base64");
  } catch {
    return { success: false, error: "Invalid signature data provided." };
  }

  if (signatureBuffer.length > 500 * 1024) {
    return {
      success: false,
      error: "Signature image exceeds the maximum permitted size of 500 KB.",
    };
  }

  const sigFilename = `signature_${input.caseId}_${todayIST}_${Date.now()}.png`;
  const signatureKey = await saveStorageFile(
    sigFilename,
    signatureBuffer,
    "image/png"
  );

  // 4. Optional photo upload
  let savedPhotoKey: string | null = null;
  if (input.photoBase64 && input.photoContentType) {
    let base64Content = input.photoBase64;
    if (base64Content.includes(",")) {
      base64Content = base64Content.split(",")[1];
    }
    const photoBuffer = Buffer.from(base64Content, "base64");

    if (photoBuffer.length <= 5 * 1024 * 1024) {
      const ext =
        input.photoContentType === "image/png"
          ? "png"
          : input.photoContentType === "image/webp"
          ? "webp"
          : "jpg";
      const photoFilename = `session_${input.caseId}_${todayIST}_${Date.now()}.${ext}`;
      savedPhotoKey = await saveStorageFile(photoFilename, photoBuffer, input.photoContentType);
    }
  }

  try {
    const result = await db.transaction(async (tx) => {
      // 5. Create the session row with snapshot & signature
      const [newSession] = await tx
        .insert(sessions)
        .values({
          caseId: input.caseId,
          therapistId: currentUser.id,
          branchId: caseRecord.branchId,
          sessionDate: todayIST,
          scheduledAt: new Date(),
          recordedAt: new Date(),
          status: "held",
          notes: note,
          workDone: note,
          presentConditionSnapshot: presentCondition,
          signatureKey,
          patientSignatureKey: signatureKey,
          photoKey: savedPhotoKey,
          completedAt: new Date(),
        })
        .returning();

      // 6. Update case's current present condition
      await tx
        .update(cases)
        .set({
          presentCondition,
        })
        .where(eq(cases.id, input.caseId));

      // 7. Record audit events: session_recorded and session_signed
      // NOTE: Location and signatures are strictly private and never placed in logs.
      await recordEvent(tx, {
        eventType: "session_recorded",
        actorId: currentUser.id,
        actorRole: "therapist",
        caseId: input.caseId,
        metadata: {
          sessionId: newSession.id,
          sessionDate: todayIST,
          hasSignature: true,
          hasConditionSnapshot: true,
        },
      });

      await recordEvent(tx, {
        eventType: "session_signed",
        actorId: currentUser.id,
        actorRole: "therapist",
        caseId: input.caseId,
        metadata: {
          sessionId: newSession.id,
          sessionDate: todayIST,
        },
      });

      // 8. Low-priority grouped in-app notification to branch admins (no email)
      await notifySessionCompleted({
        tx,
        sessionId: newSession.id,
        caseId: input.caseId,
        therapistId: currentUser.id,
        therapistName: currentUser.name,
      });

      return newSession;
    });

    revalidatePath("/therapist/dashboard");
    revalidatePath(`/therapist/cases/${input.caseId}`);

    return {
      success: true,
      session: {
        id: result.id,
        sessionDate: todayIST,
        note,
        presentConditionSnapshot: presentCondition,
        signatureKey,
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

/**
 * Edit today's session before midnight IST.
 * Locked after midnight IST.
 */
export async function updateTodaySessionAction(input: {
  caseId: string;
  sessionId: string;
  note: string;
  presentCondition?: string;
  signatureBase64?: string;
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

  const trimmedCondition = input.presentCondition?.trim();
  if (trimmedCondition && trimmedCondition.length < 10) {
    return {
      success: false,
      error: "Present condition must be at least 10 characters.",
    };
  }

  const todayIST = getTodayIST();

  // Verify session belongs to today
  const [session] = await db
    .select({
      id: sessions.id,
      sessionDate: sessions.sessionDate,
      therapistId: sessions.therapistId,
      signatureKey: sessions.signatureKey,
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

  let newSigKey = session.signatureKey;
  if (input.signatureBase64 && input.signatureBase64.length > 50) {
    let cleanSig = input.signatureBase64;
    if (cleanSig.includes(",")) {
      cleanSig = cleanSig.split(",")[1];
    }
    const sigBuffer = Buffer.from(cleanSig, "base64");
    if (sigBuffer.length <= 500 * 1024) {
      newSigKey = await saveStorageFile(
        `signature_${input.caseId}_${todayIST}_edit_${Date.now()}.png`,
        sigBuffer,
        "image/png"
      );
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(sessions)
      .set({
        notes: trimmedNote,
        workDone: trimmedNote,
        ...(trimmedCondition ? { presentConditionSnapshot: trimmedCondition } : {}),
        ...(newSigKey ? { signatureKey: newSigKey, patientSignatureKey: newSigKey } : {}),
      })
      .where(eq(sessions.id, input.sessionId));

    if (trimmedCondition) {
      await tx
        .update(cases)
        .set({ presentCondition: trimmedCondition })
        .where(eq(cases.id, input.caseId));
    }
  });

  revalidatePath("/therapist/dashboard");
  revalidatePath(`/therapist/cases/${input.caseId}`);
  return { success: true };
}

// Backward compatible alias
export const updateTodaySessionNoteAction = updateTodaySessionAction;
