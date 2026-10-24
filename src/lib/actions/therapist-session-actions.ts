"use server";

import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { sessions, cases, clients } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { recordEvent } from "@/lib/events";
import { saveStorageFile } from "@/lib/storage";
import { getTodayIST } from "@/lib/date-utils";

/**
 * Returns date as YYYY-MM-DD in Asia/Kolkata timezone.
 */
function getDateStringIST(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_SIGNATURE_SIZE = 500 * 1024; // 500 KB

export interface ActionResponse<T = unknown> {
  success: boolean;
  error?: string;
  data?: T;
}

/**
 * Step 1: Save In-Time Check-In Photo
 */
export async function saveCheckInAction(
  formData: FormData
): Promise<ActionResponse<{ inTimeAt: string; photoKey: string }>> {
  try {
    const user = await requireRole("therapist");

    const sessionId = formData.get("sessionId") as string;
    const photo = formData.get("photo") as File | null;
    const consent = formData.get("photoConsent") === "true";

    if (!sessionId) {
      return { success: false, error: "Session ID is required." };
    }

    if (!photo || !(photo instanceof File)) {
      return { success: false, error: "A valid in-time photo file is required." };
    }

    // MIME type & size validation
    if (!ALLOWED_IMAGE_TYPES.includes(photo.type)) {
      return {
        success: false,
        error: "Invalid file format. Only JPEG, PNG, or WebP images are allowed.",
      };
    }

    if (photo.size > MAX_PHOTO_SIZE) {
      return {
        success: false,
        error: "Photo size exceeds the 5 MB limit. Please compress the image.",
      };
    }

    // Retrieve session
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!session) {
      return { success: false, error: "Session not found." };
    }

    if (session.therapistId !== user.id) {
      return { success: false, error: "Forbidden: You are not assigned to this session." };
    }

    if (session.status === "held") {
      return { success: false, error: "This session has already been completed." };
    }

    // Date check: Must be today in IST
    const today = getTodayIST();
    const sessionDate = getDateStringIST(session.scheduledAt);
    if (sessionDate !== today) {
      return {
        success: false,
        error: "Sessions can only be checked in on their scheduled date (IST).",
      };
    }

    // Save photo to private storage
    const arrayBuffer = await photo.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = photo.name.split(".").pop() || "jpg";
    const filename = `session-${sessionId}-in-${Date.now()}.${ext}`;
    const fileKey = await saveStorageFile(filename, buffer, photo.type);

    const now = new Date();

    // Execute database transaction
    await db.transaction(async (tx) => {
      await tx
        .update(sessions)
        .set({
          inTimeAt: now,
          inTimePhotoKey: fileKey,
          photoConsent: consent,
        })
        .where(eq(sessions.id, sessionId));

      await recordEvent(tx, {
        eventType: "session_check_in",
        actorId: user.id,
        actorRole: "therapist",
        caseId: session.caseId,
        metadata: {
          sessionId,
          inTimeAt: now.toISOString(),
          photoKey: fileKey,
        },
      });
    });

    return {
      success: true,
      data: {
        inTimeAt: now.toISOString(),
        photoKey: fileKey,
      },
    };
  } catch (error) {
    console.error("saveCheckInAction error:", error);
    return { success: false, error: "Failed to record check-in. Please try again." };
  }
}

/**
 * Step 2: Save Work Done (Notes / Draft)
 */
export async function saveWorkDoneAction(params: {
  sessionId: string;
  workDone: string;
}): Promise<ActionResponse> {
  try {
    const user = await requireRole("therapist");
    const { sessionId, workDone } = params;

    if (!sessionId) {
      return { success: false, error: "Session ID is required." };
    }

    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!session) {
      return { success: false, error: "Session not found." };
    }

    if (session.therapistId !== user.id) {
      return { success: false, error: "Forbidden: You are not assigned to this session." };
    }

    if (session.status === "held") {
      return { success: false, error: "This session has already been completed." };
    }

    const today = getTodayIST();
    const sessionDate = getDateStringIST(session.scheduledAt);
    if (sessionDate !== today) {
      return {
        success: false,
        error: "Sessions can only be edited on their scheduled date (IST).",
      };
    }

    await db
      .update(sessions)
      .set({ workDone: workDone.trim() })
      .where(eq(sessions.id, sessionId));

    return { success: true };
  } catch (error) {
    console.error("saveWorkDoneAction error:", error);
    return { success: false, error: "Failed to save work done notes." };
  }
}

/**
 * Step 3: Save Out-Time Check-Out Photo
 */
export async function saveCheckOutAction(
  formData: FormData
): Promise<ActionResponse<{ outTimeAt: string; photoKey: string }>> {
  try {
    const user = await requireRole("therapist");

    const sessionId = formData.get("sessionId") as string;
    const photo = formData.get("photo") as File | null;

    if (!sessionId) {
      return { success: false, error: "Session ID is required." };
    }

    if (!photo || !(photo instanceof File)) {
      return { success: false, error: "A valid out-time photo file is required." };
    }

    if (!ALLOWED_IMAGE_TYPES.includes(photo.type)) {
      return {
        success: false,
        error: "Invalid file format. Only JPEG, PNG, or WebP images are allowed.",
      };
    }

    if (photo.size > MAX_PHOTO_SIZE) {
      return {
        success: false,
        error: "Photo size exceeds the 5 MB limit. Please compress the image.",
      };
    }

    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!session) {
      return { success: false, error: "Session not found." };
    }

    if (session.therapistId !== user.id) {
      return { success: false, error: "Forbidden: You are not assigned to this session." };
    }

    if (session.status === "held") {
      return { success: false, error: "This session has already been completed." };
    }

    // Must have in-time photo saved first
    if (!session.inTimeAt || !session.inTimePhotoKey) {
      return {
        success: false,
        error: "In-time photo must be saved before recording out-time.",
      };
    }

    const today = getTodayIST();
    const sessionDate = getDateStringIST(session.scheduledAt);
    if (sessionDate !== today) {
      return {
        success: false,
        error: "Sessions can only be updated on their scheduled date (IST).",
      };
    }

    const arrayBuffer = await photo.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = photo.name.split(".").pop() || "jpg";
    const filename = `session-${sessionId}-out-${Date.now()}.${ext}`;
    const fileKey = await saveStorageFile(filename, buffer, photo.type);

    const now = new Date();

    // Out-time must be equal to or after in-time
    if (now.getTime() < new Date(session.inTimeAt).getTime()) {
      return {
        success: false,
        error: "Out-time timestamp cannot be earlier than in-time timestamp.",
      };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(sessions)
        .set({
          outTimeAt: now,
          outTimePhotoKey: fileKey,
        })
        .where(eq(sessions.id, sessionId));

      await recordEvent(tx, {
        eventType: "session_check_out",
        actorId: user.id,
        actorRole: "therapist",
        caseId: session.caseId,
        metadata: {
          sessionId,
          outTimeAt: now.toISOString(),
          photoKey: fileKey,
        },
      });
    });

    return {
      success: true,
      data: {
        outTimeAt: now.toISOString(),
        photoKey: fileKey,
      },
    };
  } catch (error) {
    console.error("saveCheckOutAction error:", error);
    return { success: false, error: "Failed to record check-out. Please try again." };
  }
}

/**
 * Step 4: Save Patient Signature (Canvas PNG)
 */
export async function saveSignatureAction(
  formData: FormData
): Promise<ActionResponse<{ signatureKey: string }>> {
  try {
    const user = await requireRole("therapist");

    const sessionId = formData.get("sessionId") as string;
    const signatureFile = formData.get("signature") as File | null;
    const signatureDataUrl = formData.get("signatureDataUrl") as string | null;

    if (!sessionId) {
      return { success: false, error: "Session ID is required." };
    }

    let buffer: Buffer;
    let contentType = "image/png";

    if (signatureFile && signatureFile instanceof File) {
      if (signatureFile.size > MAX_SIGNATURE_SIZE) {
        return {
          success: false,
          error: "Signature image exceeds maximum 500 KB size limit.",
        };
      }
      if (signatureFile.type !== "image/png") {
        return {
          success: false,
          error: "Patient signature must be a PNG image.",
        };
      }
      const arrayBuffer = await signatureFile.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else if (signatureDataUrl && signatureDataUrl.startsWith("data:image/png;base64,")) {
      const base64Data = signatureDataUrl.replace(/^data:image\/png;base64,/, "");
      buffer = Buffer.from(base64Data, "base64");
      if (buffer.length > MAX_SIGNATURE_SIZE) {
        return {
          success: false,
          error: "Signature image exceeds maximum 500 KB size limit.",
        };
      }
    } else {
      return {
        success: false,
        error: "A valid patient signature PNG is required.",
      };
    }

    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!session) {
      return { success: false, error: "Session not found." };
    }

    if (session.therapistId !== user.id) {
      return { success: false, error: "Forbidden: You are not assigned to this session." };
    }

    if (session.status === "held") {
      return { success: false, error: "This session has already been completed." };
    }

    const today = getTodayIST();
    const sessionDate = getDateStringIST(session.scheduledAt);
    if (sessionDate !== today) {
      return {
        success: false,
        error: "Sessions can only be updated on their scheduled date (IST).",
      };
    }

    const filename = `session-${sessionId}-sig-${Date.now()}.png`;
    const fileKey = await saveStorageFile(filename, buffer, contentType);

    await db.transaction(async (tx) => {
      await tx
        .update(sessions)
        .set({ patientSignatureKey: fileKey })
        .where(eq(sessions.id, sessionId));

      await recordEvent(tx, {
        eventType: "session_signed",
        actorId: user.id,
        actorRole: "therapist",
        caseId: session.caseId,
        metadata: {
          sessionId,
          signatureKey: fileKey,
        },
      });
    });

    return {
      success: true,
      data: { signatureKey: fileKey },
    };
  } catch (error) {
    console.error("saveSignatureAction error:", error);
    return { success: false, error: "Failed to record signature. Please try again." };
  }
}

/**
 * Step 5: Complete Session (Server enforces all 4 requirements)
 */
export async function completeSessionAction(params: {
  sessionId: string;
}): Promise<ActionResponse<{ completedAt: string }>> {
  try {
    const user = await requireRole("therapist");
    const { sessionId } = params;

    if (!sessionId) {
      return { success: false, error: "Session ID is required." };
    }

    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!session) {
      return { success: false, error: "Session not found." };
    }

    if (session.therapistId !== user.id) {
      return { success: false, error: "Forbidden: You are not assigned to this session." };
    }

    if (session.status === "held") {
      return { success: false, error: "This session has already been completed." };
    }

    const today = getTodayIST();
    const sessionDate = getDateStringIST(session.scheduledAt);
    if (sessionDate !== today) {
      return {
        success: false,
        error: "Sessions can only be completed on their scheduled date (IST).",
      };
    }

    // STRICT SERVER ENFORCEMENT: All 4 requirements must exist
    if (!session.inTimePhotoKey) {
      return {
        success: false,
        error: "Cannot complete session: In-time photo is required.",
      };
    }

    if (!session.workDone || session.workDone.trim().length < 10) {
      return {
        success: false,
        error: "Cannot complete session: 'What you have done' notes must contain at least 10 characters.",
      };
    }

    if (!session.outTimePhotoKey) {
      return {
        success: false,
        error: "Cannot complete session: Out-time photo is required.",
      };
    }

    if (!session.patientSignatureKey) {
      return {
        success: false,
        error: "Cannot complete session: Patient signature is required.",
      };
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      // 1. Mark session as held/completed
      await tx
        .update(sessions)
        .set({
          status: "held",
          completedAt: now,
        })
        .where(eq(sessions.id, sessionId));

      // 2. Record session_held event (so date-wise analytics count this session)
      await recordEvent(tx, {
        eventType: "session_held",
        actorId: user.id,
        actorRole: "therapist",
        caseId: session.caseId,
        metadata: {
          sessionId,
          completedAt: now.toISOString(),
          scheduledAt: session.scheduledAt.toISOString(),
        },
      });
    });

    return {
      success: true,
      data: {
        completedAt: now.toISOString(),
      },
    };
  } catch (error) {
    console.error("completeSessionAction error:", error);
    return { success: false, error: "Failed to complete session." };
  }
}
