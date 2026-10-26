"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  cases,
  casePhotos,
  progressReports,
  caseOutcomeEnum,
  type CaseOutcome,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { recordEvent } from "@/lib/events";
import { notifyCaseClosed } from "@/lib/notifications/in-app";
import { triggerOpportunisticQueueProcess } from "@/lib/notifications";
import { saveStorageFile } from "@/lib/storage";
import { getTodayIST } from "@/lib/date-utils";

export interface CloseCasePhotoInput {
  base64Data: string;
  filename: string;
  contentType: string;
}

export interface CloseCaseInput {
  caseId: string;
  // Final Progress Report fields (written in words by therapist)
  currentCondition: string;
  progressText: string;
  treatmentPlan?: string;
  remarks?: string;
  // Closure & outcome fields
  photos: CloseCasePhotoInput[];
  outcome: "improved" | "partially_improved" | "no_change" | "referred";
  closingSummary: string;
  // Backward compatibility alias for presentCondition if passed
  presentCondition?: string;
}

export interface CloseCaseResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

const closeCaseSchema = z.object({
  caseId: z.string().uuid("Invalid case ID."),
  currentCondition: z
    .string()
    .trim()
    .min(10, "Current condition must be at least 10 characters.")
    .max(3000, "Current condition cannot exceed 3,000 characters."),
  progressText: z
    .string()
    .trim()
    .min(20, "Progress since last report must be at least 20 characters.")
    .max(3000, "Progress text cannot exceed 3,000 characters."),
  treatmentPlan: z
    .string()
    .trim()
    .max(3000, "Treatment plan cannot exceed 3,000 characters.")
    .optional(),
  remarks: z
    .string()
    .trim()
    .max(3000, "Remarks cannot exceed 3,000 characters.")
    .optional(),
  outcome: z.enum(
    ["improved", "partially_improved", "no_change", "referred"] as const,
    {
      message: "Select a valid outcome.",
    }
  ),
  closingSummary: z.string().trim().min(2, "Closing summary is required."),
});

export async function closeCaseTherapistAction(
  input: CloseCaseInput
): Promise<CloseCaseResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "therapist") {
    return { success: false, error: "Only therapists can close cases." };
  }

  // Normalize: if currentCondition is empty but presentCondition was provided, use it
  const normalizedInput = {
    ...input,
    currentCondition: input.currentCondition?.trim() || input.presentCondition?.trim() || "",
  };

  // 1. Zod Validation
  const parsed = closeCaseSchema.safeParse(normalizedInput);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    parsed.error.issues.forEach((err) => {
      const field = String(err.path[0] || "form");
      fieldErrors[field] = err.message;
    });
    return {
      success: false,
      error: "Please complete all required final progress report and closure fields.",
      fieldErrors,
    };
  }

  const { caseId, currentCondition, progressText, treatmentPlan, remarks, outcome, closingSummary } =
    parsed.data;

  // 2. Validate photos: 1 to 3 images, JPEG/PNG/WebP, max 5MB
  const rawPhotos = input.photos || [];
  if (rawPhotos.length === 0) {
    return {
      success: false,
      error: "At least one present condition photo is required.",
      fieldErrors: { photos: "Present condition photo is required." },
    };
  }

  if (rawPhotos.length > 3) {
    return {
      success: false,
      error: "A maximum of 3 present condition photos can be uploaded.",
      fieldErrors: { photos: "Maximum 3 photos allowed." },
    };
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  for (const p of rawPhotos) {
    if (!allowedTypes.includes(p.contentType?.toLowerCase())) {
      return {
        success: false,
        error: "Only JPEG, PNG, and WebP images are allowed.",
        fieldErrors: { photos: "Only JPEG, PNG, and WebP images are allowed." },
      };
    }
  }

  // 3. Verify case ownership and active state
  const [caseRecord] = await db
    .select({
      id: cases.id,
      caseNumber: cases.caseNumber,
      patientId: cases.patientId,
      currentTherapistId: cases.currentTherapistId,
      createdBy: cases.createdBy,
      status: cases.status,
    })
    .from(cases)
    .where(eq(cases.id, caseId))
    .limit(1);

  if (!caseRecord) {
    return { success: false, error: "Case not found." };
  }

  if (caseRecord.currentTherapistId !== currentUser.id && caseRecord.createdBy !== currentUser.id) {
    return {
      success: false,
      error: "You are not authorized to close this case.",
    };
  }

  if (caseRecord.status === "completed") {
    return { success: false, error: "This case is already closed." };
  }

  // Verify only one final report per case constraint
  const [existingFinal] = await db
    .select({ id: progressReports.id })
    .from(progressReports)
    .where(eq(progressReports.caseId, caseId));

  const closedAtDate = new Date();
  const todayIST = getTodayIST();

  try {
    await db.transaction(async (tx) => {
      // 4. Insert Final Progress Report (type = 'final', status = 'submitted', locked_at = now)
      const [finalReport] = await tx
        .insert(progressReports)
        .values({
          caseId,
          authorId: currentUser.id,
          reportType: "final",
          status: "submitted",
          reportDate: todayIST,
          currentCondition,
          progressText,
          treatmentPlan: treatmentPlan || null,
          remarks: remarks || null,
          submittedAt: closedAtDate,
          lockedAt: closedAtDate,
          createdAt: closedAtDate,
          updatedAt: closedAtDate,
        })
        .returning({ id: progressReports.id });

      // Lock any previous reports for this case
      await tx
        .update(progressReports)
        .set({ lockedAt: closedAtDate })
        .where(eq(progressReports.caseId, caseId));

      // 5. Update case status to completed
      await tx
        .update(cases)
        .set({
          status: "completed",
          closedAt: closedAtDate,
          presentConditionAtClose: currentCondition,
          outcome: outcome as CaseOutcome,
          closingNotes: closingSummary,
        })
        .where(eq(cases.id, caseId));

      // 6. Save present photos
      for (let i = 0; i < rawPhotos.length; i++) {
        const photo = rawPhotos[i];
        let base64Content = photo.base64Data;
        if (base64Content.includes(",")) {
          base64Content = base64Content.split(",")[1];
        }
        const buffer = Buffer.from(base64Content, "base64");

        if (buffer.length > 5 * 1024 * 1024) {
          throw new Error("Each photo must be smaller than 5 MB.");
        }

        const ext =
          photo.contentType === "image/png"
            ? "png"
            : photo.contentType === "image/webp"
            ? "webp"
            : "jpg";
        const filename = `present_${caseId}_${i + 1}_${Date.now()}.${ext}`;
        const fileKey = await saveStorageFile(filename, buffer, photo.contentType);

        await tx.insert(casePhotos).values({
          caseId,
          kind: "present",
          fileKey,
          uploadedBy: currentUser.id,
        });
      }

      // 7. Record audit events (Never record clinical report text!)
      await recordEvent(tx, {
        eventType: "final_report_submitted",
        actorId: currentUser.id,
        actorRole: "therapist",
        caseId,
        metadata: {
          reportId: finalReport.id,
          reportType: "final",
        },
      });

      await recordEvent(tx, {
        eventType: "case_closed",
        actorId: currentUser.id,
        actorRole: "therapist",
        caseId,
        fromStatus: caseRecord.status,
        toStatus: "completed",
        metadata: {
          outcome,
          closingSummary,
          closedAt: closedAtDate.toISOString(),
        },
      });

      await recordEvent(tx, {
        eventType: "present_photo_added",
        actorId: currentUser.id,
        actorRole: "therapist",
        caseId,
        metadata: {
          photoCount: rawPhotos.length,
        },
      });

      // 8. Dispatch existing notifications to admins (in-app plus email)
      await notifyCaseClosed({
        tx,
        caseId,
        caseNumber: caseRecord.caseNumber,
        outcome,
        therapistName: currentUser.name,
        createdById: caseRecord.createdBy,
        closedAt: closedAtDate,
      });
    });

    triggerOpportunisticQueueProcess();

    revalidatePath(`/therapist/cases/${caseId}`);
    revalidatePath(`/cases/${caseId}/report`);
    revalidatePath("/therapist/dashboard");
    revalidatePath("/admin/cases");

    return { success: true };
  } catch (err: any) {
    console.error("Error closing case:", err);
    return {
      success: false,
      error: err.message || "Failed to close case. Please try again.",
    };
  }
}
