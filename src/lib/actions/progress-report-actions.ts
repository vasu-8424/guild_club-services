"use server";

import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  cases,
  users,
  progressReports,
  progressReportVersions,
  type ProgressReport,
} from "@/db/schema";
import { getCurrentUser, requireRole } from "@/lib/session";
import { getTodayIST } from "@/lib/date-utils";
import { recordEvent } from "@/lib/events";
import { notifyProgressReportSubmitted } from "@/lib/notifications/in-app";

export interface ProgressReportItem {
  id: string;
  caseId: string;
  authorId: string;
  authorName: string;
  reportType: "update" | "final";
  status: "draft" | "submitted";
  reportDate: string;
  currentCondition: string;
  progressText: string;
  treatmentPlan: string | null;
  remarks: string | null;
  submittedAt: Date | null;
  lockedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  versionCount: number;
  canEdit: boolean;
}

export interface ProgressReportActionResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  reportId?: string;
  reports?: ProgressReportItem[];
}

const submitReportSchema = z.object({
  caseId: z.string().uuid("Invalid case ID."),
  reportId: z.string().uuid("Invalid report ID.").optional(),
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
});

const draftReportSchema = z.object({
  caseId: z.string().uuid("Invalid case ID."),
  reportId: z.string().uuid("Invalid report ID.").optional(),
  currentCondition: z
    .string()
    .trim()
    .min(1, "Please provide current condition notes to save draft.")
    .max(3000, "Current condition cannot exceed 3,000 characters."),
  progressText: z
    .string()
    .trim()
    .max(3000, "Progress text cannot exceed 3,000 characters.")
    .optional(),
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
});

/**
 * Saves or updates a progress report as DRAFT.
 * Private to the authoring therapist. Not visible to Admin/Super Admin.
 */
export async function saveReportDraftAction(input: {
  caseId: string;
  reportId?: string;
  currentCondition: string;
  progressText?: string;
  treatmentPlan?: string;
  remarks?: string;
}): Promise<ProgressReportActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "therapist") {
    return { success: false, error: "Only therapists can write progress reports." };
  }

  const parsed = draftReportSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0]?.toString() || "form";
      fieldErrors[field] = issue.message;
    }
    return { success: false, fieldErrors, error: "Please fix validation errors." };
  }

  const { caseId, reportId, currentCondition, progressText, treatmentPlan, remarks } = parsed.data;

  // Verify case exists, is active, and therapist owns it
  const [caseRecord] = await db
    .select({
      id: cases.id,
      patientId: cases.patientId,
      caseNumber: cases.caseNumber,
      currentTherapistId: cases.currentTherapistId,
      createdBy: cases.createdBy,
      status: cases.status,
    })
    .from(cases)
    .where(eq(cases.id, caseId));

  if (!caseRecord) {
    return { success: false, error: "Case not found." };
  }

  if (caseRecord.currentTherapistId !== currentUser.id && caseRecord.createdBy !== currentUser.id) {
    return { success: false, error: "You are not authorized to write reports for this case." };
  }

  if (caseRecord.status === "completed") {
    return { success: false, error: "Cannot create or edit reports for a closed case." };
  }

  const todayIST = getTodayIST();
  let savedId = reportId;

  if (reportId) {
    // Update existing draft
    const [existing] = await db
      .select()
      .from(progressReports)
      .where(and(eq(progressReports.id, reportId), eq(progressReports.caseId, caseId)));

    if (!existing) {
      return { success: false, error: "Report not found." };
    }

    if (existing.authorId !== currentUser.id) {
      return { success: false, error: "You can only edit your own reports." };
    }

    if (existing.status !== "draft") {
      return { success: false, error: "Submitted reports must use the edit submitted action." };
    }

    await db
      .update(progressReports)
      .set({
        currentCondition,
        progressText: progressText || "",
        treatmentPlan: treatmentPlan || null,
        remarks: remarks || null,
        updatedAt: new Date(),
      })
      .where(eq(progressReports.id, reportId));
  } else {
    // Insert new draft
    const [inserted] = await db
      .insert(progressReports)
      .values({
        caseId,
        authorId: currentUser.id,
        reportType: "update",
        status: "draft",
        reportDate: todayIST,
        currentCondition,
        progressText: progressText || "",
        treatmentPlan: treatmentPlan || null,
        remarks: remarks || null,
      })
      .returning({ id: progressReports.id });

    savedId = inserted.id;

    // Record audit event (Never include clinical report text in event metadata!)
    await recordEvent(db, {
      eventType: "report_saved_draft",
      actorId: currentUser.id,
      actorRole: "therapist",
      caseId,
      metadata: {
        reportId: savedId,
        reportType: "update",
      },
    });
  }

  revalidatePath(`/therapist/cases/${caseId}`);
  revalidatePath(`/cases/${caseId}/report`);
  return { success: true, reportId: savedId };
}

/**
 * Submits a progress report (either new or converting an existing draft).
 * Visible to Admin and Super Admin. Locks 24 hours after submission.
 */
export async function submitReportAction(input: {
  caseId: string;
  reportId?: string;
  currentCondition: string;
  progressText: string;
  treatmentPlan?: string;
  remarks?: string;
}): Promise<ProgressReportActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "therapist") {
    return { success: false, error: "Only therapists can submit progress reports." };
  }

  const parsed = submitReportSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0]?.toString() || "form";
      fieldErrors[field] = issue.message;
    }
    return { success: false, fieldErrors, error: "Please fix validation errors." };
  }

  const { caseId, reportId, currentCondition, progressText, treatmentPlan, remarks } = parsed.data;

  // Verify case exists, is active, and therapist owns it
  const [caseRecord] = await db
    .select({
      id: cases.id,
      patientId: cases.patientId,
      caseNumber: cases.caseNumber,
      currentTherapistId: cases.currentTherapistId,
      createdBy: cases.createdBy,
      status: cases.status,
    })
    .from(cases)
    .where(eq(cases.id, caseId));

  if (!caseRecord) {
    return { success: false, error: "Case not found." };
  }

  if (caseRecord.currentTherapistId !== currentUser.id && caseRecord.createdBy !== currentUser.id) {
    return { success: false, error: "You are not authorized to submit reports for this case." };
  }

  if (caseRecord.status === "completed") {
    return { success: false, error: "Cannot submit reports for a closed case." };
  }

  const todayIST = getTodayIST();
  const now = new Date();
  let submittedId = reportId;

  await db.transaction(async (tx) => {
    if (reportId) {
      const [existing] = await tx
        .select()
        .from(progressReports)
        .where(and(eq(progressReports.id, reportId), eq(progressReports.caseId, caseId)));

      if (!existing) {
        throw new Error("Report not found.");
      }

      if (existing.authorId !== currentUser.id) {
        throw new Error("You can only submit your own reports.");
      }

      if (existing.status === "submitted") {
        throw new Error("Report is already submitted.");
      }

      await tx
        .update(progressReports)
        .set({
          status: "submitted",
          reportDate: todayIST,
          currentCondition,
          progressText,
          treatmentPlan: treatmentPlan || null,
          remarks: remarks || null,
          submittedAt: now,
          updatedAt: now,
        })
        .where(eq(progressReports.id, reportId));
    } else {
      const [inserted] = await tx
        .insert(progressReports)
        .values({
          caseId,
          authorId: currentUser.id,
          reportType: "update",
          status: "submitted",
          reportDate: todayIST,
          currentCondition,
          progressText,
          treatmentPlan: treatmentPlan || null,
          remarks: remarks || null,
          submittedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: progressReports.id });

      submittedId = inserted.id;
    }

    // In-App Notification to Admins and Super Admins (grouped if multiple within 30 min)
    // Never contains clinical text!
    await notifyProgressReportSubmitted({
      tx,
      caseId,
      patientId: caseRecord.patientId || caseRecord.caseNumber,
      caseNumber: caseRecord.caseNumber,
      therapistId: currentUser.id,
      therapistName: currentUser.name || "Therapist",
    });

    // Record audit event
    await recordEvent(tx, {
      eventType: "report_submitted",
      actorId: currentUser.id,
      actorRole: "therapist",
      caseId,
      metadata: {
        reportId: submittedId,
        reportType: "update",
      },
    });
  });

  revalidatePath(`/therapist/cases/${caseId}`);
  revalidatePath(`/cases/${caseId}/report`);
  revalidatePath(`/admin/cases/${caseId}`);
  return { success: true, reportId: submittedId };
}

/**
 * Updates a submitted report within the 24-hour edit window.
 * Stores previous version snapshot in progress_report_versions.
 */
export async function updateReportAction(input: {
  reportId: string;
  caseId: string;
  currentCondition: string;
  progressText: string;
  treatmentPlan?: string;
  remarks?: string;
}): Promise<ProgressReportActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "therapist") {
    return { success: false, error: "Only therapists can edit progress reports." };
  }

  const parsed = submitReportSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0]?.toString() || "form";
      fieldErrors[field] = issue.message;
    }
    return { success: false, fieldErrors, error: "Please fix validation errors." };
  }

  const { reportId, caseId, currentCondition, progressText, treatmentPlan, remarks } = parsed.data;
  if (!reportId) {
    return { success: false, error: "Report ID is required for updating." };
  }

  const [report] = await db
    .select()
    .from(progressReports)
    .where(and(eq(progressReports.id, reportId), eq(progressReports.caseId, caseId)));

  if (!report) {
    return { success: false, error: "Report not found." };
  }

  if (report.authorId !== currentUser.id) {
    return { success: false, error: "You can only edit your own reports." };
  }

  if (report.lockedAt) {
    return { success: false, error: "This report is permanently locked and cannot be edited." };
  }

  // 24-hour edit window verification
  if (report.status === "submitted") {
    if (!report.submittedAt) {
      return { success: false, error: "Invalid submission timestamp." };
    }
    const elapsedMs = Date.now() - new Date(report.submittedAt).getTime();
    if (elapsedMs > 24 * 60 * 60 * 1000) {
      return {
        success: false,
        error: "Reports can only be edited within 24 hours of submission.",
      };
    }
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    if (report.status === "submitted") {
      // Fetch current version count
      const [verCountRow] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(progressReportVersions)
        .where(eq(progressReportVersions.reportId, reportId));

      const newVersionNo = (verCountRow?.count || 0) + 1;

      // Save previous version snapshot
      await tx.insert(progressReportVersions).values({
        reportId,
        versionNo: newVersionNo,
        snapshot: {
          currentCondition: report.currentCondition,
          progressText: report.progressText,
          treatmentPlan: report.treatmentPlan,
          remarks: report.remarks,
        },
        editedAt: now,
        editorId: currentUser.id,
      });

      // Update report text
      await tx
        .update(progressReports)
        .set({
          currentCondition,
          progressText,
          treatmentPlan: treatmentPlan || null,
          remarks: remarks || null,
          updatedAt: now,
        })
        .where(eq(progressReports.id, reportId));

      // Record audit event
      await recordEvent(tx, {
        eventType: "report_edited",
        actorId: currentUser.id,
        actorRole: "therapist",
        caseId,
        metadata: {
          reportId,
          versionNo: newVersionNo,
        },
      });
    } else {
      // Draft update: no version created
      await tx
        .update(progressReports)
        .set({
          currentCondition,
          progressText,
          treatmentPlan: treatmentPlan || null,
          remarks: remarks || null,
          updatedAt: now,
        })
        .where(eq(progressReports.id, reportId));

      await recordEvent(tx, {
        eventType: "report_saved_draft",
        actorId: currentUser.id,
        actorRole: "therapist",
        caseId,
        metadata: {
          reportId,
        },
      });
    }
  });

  revalidatePath(`/therapist/cases/${caseId}`);
  revalidatePath(`/cases/${caseId}/report`);
  return { success: true, reportId };
}

/**
 * Retrieves all progress reports for a case according to caller's role.
 * - Therapists: see all (drafts + submitted) if owning the case. 403 otherwise.
 * - Admins/Super Admins: see ONLY submitted reports. Drafts are omitted.
 */
export async function getCaseReportsAction(caseId: string): Promise<ProgressReportActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { success: false, error: "Unauthorized." };
  }

  // Fetch case
  const [caseRecord] = await db
    .select({
      id: cases.id,
      currentTherapistId: cases.currentTherapistId,
      createdBy: cases.createdBy,
    })
    .from(cases)
    .where(eq(cases.id, caseId));

  if (!caseRecord) {
    return { success: false, error: "Case not found." };
  }

  // Role checks
  if (currentUser.role === "therapist") {
    if (caseRecord.currentTherapistId !== currentUser.id && caseRecord.createdBy !== currentUser.id) {
      return { success: false, error: "Unauthorized access to case reports." };
    }
  }

  // Query reports
  const query = db
    .select({
      report: progressReports,
      authorName: users.name,
      versionCount: sql<number>`count(${progressReportVersions.id})::int`,
    })
    .from(progressReports)
    .innerJoin(users, eq(progressReports.authorId, users.id))
    .leftJoin(
      progressReportVersions,
      eq(progressReports.id, progressReportVersions.reportId)
    )
    .where(
      and(
        eq(progressReports.caseId, caseId),
        // If Admin/Super Admin, only see submitted reports!
        currentUser.role !== "therapist" ? eq(progressReports.status, "submitted") : undefined
      )
    )
    .groupBy(progressReports.id, users.name)
    .orderBy(desc(progressReports.createdAt));

  const rows = await query;
  const now = Date.now();

  const reports: ProgressReportItem[] = rows.map((r) => {
    const isOwner = currentUser.role === "therapist" && r.report.authorId === currentUser.id;
    let canEdit = false;

    if (isOwner && !r.report.lockedAt) {
      if (r.report.status === "draft") {
        canEdit = true;
      } else if (r.report.status === "submitted" && r.report.submittedAt) {
        const elapsed = now - new Date(r.report.submittedAt).getTime();
        canEdit = elapsed <= 24 * 60 * 60 * 1000;
      }
    }

    return {
      id: r.report.id,
      caseId: r.report.caseId,
      authorId: r.report.authorId,
      authorName: r.authorName || "Therapist",
      reportType: r.report.reportType as "update" | "final",
      status: r.report.status as "draft" | "submitted",
      reportDate: r.report.reportDate,
      currentCondition: r.report.currentCondition,
      progressText: r.report.progressText,
      treatmentPlan: r.report.treatmentPlan,
      remarks: r.report.remarks,
      submittedAt: r.report.submittedAt,
      lockedAt: r.report.lockedAt,
      createdAt: r.report.createdAt,
      updatedAt: r.report.updatedAt,
      versionCount: r.versionCount || 0,
      canEdit,
    };
  });

  return { success: true, reports };
}
