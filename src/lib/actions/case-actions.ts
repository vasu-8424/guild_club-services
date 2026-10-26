"use server";

import { revalidatePath } from "next/cache";
import { eq, and, or, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  cases,
  clients,
  users,
  sessions,
  caseNotes,
  caseEvents,
  therapistRoomAssignments,
  type CaseStatus,
} from "@/db/schema";
import { requireRole, getCurrentUser } from "@/lib/session";
import { recordEvent } from "@/lib/events";
import { queueEmail } from "@/lib/email";
import { triggerOpportunisticQueueProcess } from "@/lib/notifications";
import { notifyCaseClosed } from "@/lib/notifications/in-app";
import { generateCaseNumber } from "@/lib/case-number";
import {
  createCaseSchema,
  assignCaseSchema,
  acceptCaseSchema,
  declineCaseSchema,
  updateCaseStatusSchema,
  closeCaseSchema,
  addNoteSchema,
  scheduleSessionSchema,
  updateSessionStatusSchema,
  type CreateCaseInput,
  type AssignCaseInput,
  type AcceptCaseInput,
  type DeclineCaseInput,
  type UpdateCaseStatusInput,
  type CloseCaseInput,
  type AddNoteInput,
  type ScheduleSessionInput,
  type UpdateSessionStatusInput,
} from "@/lib/validators";

export type ActionResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

/**
 * Therapist only: Create a new Case and Client in a single transaction.
 * Admins and Super Admins are forbidden from creating cases per therapist-simplification.
 */
export async function createCaseAction(
  rawInput: CreateCaseInput
): Promise<ActionResponse<{ id: string; caseNumber: string }>> {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "therapist") {
    return {
      success: false,
      error: "Forbidden: Only therapists are authorized to create cases.",
    };
  }

  const parsed = createCaseSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const {
    clientName,
    clientEmail,
    clientPhone,
    clientAge,
    clientGender,
    category,
    presentingIssues,
    priority,
    initialNotes,
    assignedTherapistId,
  } = parsed.data;

  try {
    const result = await db.transaction(async (tx) => {
      // 1. Create client
      const [newClient] = await tx
        .insert(clients)
        .values({
          fullName: clientName,
          email: clientEmail,
          phone: clientPhone,
          age: clientAge ?? 30,
          gender: clientGender ?? "Not specified",
        })
        .returning({ id: clients.id, fullName: clients.fullName });

      // 2. Generate unique case number safely inside tx
      const caseNumber = await generateCaseNumber(tx as any);

      const hasTherapist = Boolean(assignedTherapistId && assignedTherapistId !== "");
      const initialStatus: CaseStatus = hasTherapist ? "assigned" : "new";

      // 3. Create case
      const [newCase] = await tx
        .insert(cases)
        .values({
          caseNumber,
          clientId: newClient.id,
          category,
          priority,
          description: presentingIssues,
          status: initialStatus,
          createdBy: currentUser.id,
          currentTherapistId: hasTherapist ? assignedTherapistId : null,
        })
        .returning({ id: cases.id, caseNumber: cases.caseNumber });

      // 4. Record case_created event
      await recordEvent(tx, {
        eventType: "case_created",
        actorId: currentUser.id,
        actorRole: currentUser.role,
        caseId: newCase.id,
        metadata: {
          caseNumber,
          clientName,
          category,
          priority,
        },
      });

      // 5. If initial note provided, save it
      if (initialNotes && initialNotes.trim().length > 0) {
        await tx.insert(caseNotes).values({
          caseId: newCase.id,
          authorId: currentUser.id,
          note: initialNotes.trim(),
        });

        await recordEvent(tx, {
          eventType: "note_added",
          actorId: currentUser.id,
          actorRole: currentUser.role,
          caseId: newCase.id,
          metadata: { noteSnippet: initialNotes.trim().slice(0, 50) },
        });
      }

      // 6. If therapist assigned at creation, handle assignment
      if (hasTherapist && assignedTherapistId) {
        const [therapist] = await tx
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            isActive: users.isActive,
          })
          .from(users)
          .where(eq(users.id, assignedTherapistId))
          .limit(1);

        if (therapist && therapist.isActive) {
          await recordEvent(tx, {
            eventType: "case_assigned",
            actorId: currentUser.id,
            actorRole: currentUser.role,
            caseId: newCase.id,
            targetUserId: therapist.id,
            fromStatus: "new",
            toStatus: "assigned",
            metadata: { therapistName: therapist.name },
          });

          // Note: case_assigned email removed per user directive (therapists create cases and assign to themselves).
        }
      }

      return newCase;
    });

    triggerOpportunisticQueueProcess();

    revalidatePath("/admin/cases");
    revalidatePath("/therapist/dashboard");

    return {
      success: true,
      data: {
        id: result.id,
        caseNumber: result.caseNumber,
      },
    };
  } catch (error) {
    console.error("Failed to create case:", error);
    return {
      success: false,
      error: "An unexpected error occurred while creating the case.",
    };
  }
}

/**
 * Admin / Super Admin: Assign or Reassign a Case to a Therapist.
 */
export async function assignCaseAction(
  rawInput: AssignCaseInput
): Promise<ActionResponse<{ id: string }>> {
  const currentUser = await requireRole("admin", "super_admin");

  const parsed = assignCaseSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { caseId, therapistId, notes } = parsed.data;

  try {
    // 1. Verify case
    const [existingCase] = await db
      .select({
        id: cases.id,
        caseNumber: cases.caseNumber,
        category: cases.category,
        priority: cases.priority,
        status: cases.status,
        currentTherapistId: cases.currentTherapistId,
        clientId: cases.clientId,
      })
      .from(cases)
      .where(eq(cases.id, caseId))
      .limit(1);

    if (!existingCase) {
      return { success: false, error: "Case not found." };
    }

    if (existingCase.status === "completed") {
      return { success: false, error: "Cannot reassign a closed case." };
    }

    // 2. Verify therapist is active
    const [therapist] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, therapistId))
      .limit(1);

    if (!therapist || !therapist.isActive) {
      return {
        success: false,
        error: "Cannot assign case to an inactive or non-existent therapist.",
      };
    }

    // Get client name for email
    const [client] = await db
      .select({ fullName: clients.fullName })
      .from(clients)
      .where(eq(clients.id, existingCase.clientId))
      .limit(1);

    const isReassign = Boolean(
      existingCase.currentTherapistId &&
        existingCase.currentTherapistId !== therapistId
    );

    await db.transaction(async (tx) => {
      await tx
        .update(cases)
        .set({
          currentTherapistId: therapistId,
          status: "assigned",
        })
        .where(eq(cases.id, caseId));

      await recordEvent(tx, {
        eventType: isReassign ? "case_reassigned" : "case_assigned",
        actorId: currentUser.id,
        actorRole: currentUser.role,
        caseId,
        targetUserId: therapistId,
        fromStatus: existingCase.status,
        toStatus: "assigned",
        metadata: {
          therapistName: therapist.name,
          previousTherapistId: existingCase.currentTherapistId,
          notes: notes ?? null,
        },
      });

      if (notes && notes.trim().length > 0) {
        await tx.insert(caseNotes).values({
          caseId,
          authorId: currentUser.id,
          note: `Assignment note: ${notes.trim()}`,
        });

        await recordEvent(tx, {
          eventType: "note_added",
          actorId: currentUser.id,
          actorRole: currentUser.role,
          caseId,
          metadata: { noteSnippet: notes.trim().slice(0, 50) },
        });
      }

      const assignedDate = new Date().toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      if (isReassign && existingCase.currentTherapistId) {
        // 1. Notify previous therapist
        const [prevTherapist] = await tx
          .select({ name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, existingCase.currentTherapistId))
          .limit(1);

        if (prevTherapist) {
          await queueEmail(tx as any, {
            toEmail: prevTherapist.email,
            toName: prevTherapist.name,
            template: "case_unassigned",
            payload: {
              therapistName: prevTherapist.name,
              caseNumber: existingCase.caseNumber,
              reassignedDate: assignedDate,
            },
          });
        }

        // 2. Notify new therapist
        await queueEmail(tx as any, {
          toEmail: therapist.email,
          toName: therapist.name,
          template: "case_reassigned",
          payload: {
            therapistName: therapist.name,
            caseNumber: existingCase.caseNumber,
            priority: existingCase.priority,
            category: existingCase.category,
            assignedBy: currentUser.name,
            assignedDate,
            caseId,
          },
        });
      } else {
        // Initial assignment: case_assigned email removed per user directive.
      }
    });

    triggerOpportunisticQueueProcess();

    revalidatePath("/admin/cases");
    revalidatePath(`/admin/cases/${caseId}`);
    revalidatePath("/therapist/dashboard");

    return { success: true, data: { id: caseId } };
  } catch (error) {
    console.error("Failed to assign case:", error);
    return {
      success: false,
      error: "An unexpected error occurred while assigning the case.",
    };
  }
}

/**
 * Therapist: Accept an assigned case.
 */
export async function acceptCaseAction(
  rawInput: AcceptCaseInput
): Promise<ActionResponse<{ id: string }>> {
  const currentUser = await requireRole("therapist");

  const parsed = acceptCaseSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { caseId } = parsed.data;

  try {
    const [targetCase] = await db
      .select({
        id: cases.id,
        status: cases.status,
        currentTherapistId: cases.currentTherapistId,
      })
      .from(cases)
      .where(eq(cases.id, caseId))
      .limit(1);

    if (!targetCase) {
      return { success: false, error: "Case not found." };
    }

    if (targetCase.currentTherapistId !== currentUser.id) {
      return { success: false, error: "You are not assigned to this case." };
    }

    if (targetCase.status !== "assigned") {
      return {
        success: false,
        error: `Case cannot be accepted from '${targetCase.status}' status.`,
      };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(cases)
        .set({ status: "accepted" })
        .where(eq(cases.id, caseId));

      await recordEvent(tx, {
        eventType: "case_accepted",
        actorId: currentUser.id,
        actorRole: currentUser.role,
        caseId,
        fromStatus: "assigned",
        toStatus: "accepted",
      });
    });

    revalidatePath("/admin/cases");
    revalidatePath(`/admin/cases/${caseId}`);
    revalidatePath("/therapist/dashboard");
    revalidatePath(`/therapist/cases/${caseId}`);

    return { success: true, data: { id: caseId } };
  } catch (error) {
    console.error("Failed to accept case:", error);
    return {
      success: false,
      error: "An unexpected error occurred while accepting the case.",
    };
  }
}

/**
 * Therapist: Decline an assigned case with a required reason.
 * Case returns to 'new' status and notifies the creator/admin.
 */
export async function declineCaseAction(
  rawInput: DeclineCaseInput
): Promise<ActionResponse<{ id: string }>> {
  const currentUser = await requireRole("therapist");

  const parsed = declineCaseSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { caseId, reason } = parsed.data;

  try {
    const [targetCase] = await db
      .select({
        id: cases.id,
        caseNumber: cases.caseNumber,
        status: cases.status,
        currentTherapistId: cases.currentTherapistId,
        createdBy: cases.createdBy,
      })
      .from(cases)
      .where(eq(cases.id, caseId))
      .limit(1);

    if (!targetCase) {
      return { success: false, error: "Case not found." };
    }

    if (targetCase.currentTherapistId !== currentUser.id) {
      return { success: false, error: "You are not assigned to this case." };
    }

    if (targetCase.status !== "assigned") {
      return {
        success: false,
        error: `Case cannot be declined from '${targetCase.status}' status.`,
      };
    }

    // Find assigning admin to notify (latest assign event or creator)
    const [latestAssignEvent] = await db
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
      .orderBy(sql`${caseEvents.occurredAt} DESC`)
      .limit(1);

    const adminIdToNotify = latestAssignEvent?.actorId || targetCase.createdBy;
    const [adminToNotify] = adminIdToNotify
      ? await db
          .select({ name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, adminIdToNotify))
          .limit(1)
      : [null];

    await db.transaction(async (tx) => {
      // Clear therapist and set status back to 'new'
      await tx
        .update(cases)
        .set({
          status: "new",
          currentTherapistId: null,
        })
        .where(eq(cases.id, caseId));

      await recordEvent(tx, {
        eventType: "case_declined",
        actorId: currentUser.id,
        actorRole: currentUser.role,
        caseId,
        fromStatus: "assigned",
        toStatus: "new",
        metadata: {
          reason,
          therapistName: currentUser.name,
        },
      });

      // Record reason in case notes as well
      await tx.insert(caseNotes).values({
        caseId,
        authorId: currentUser.id,
        note: `Declined by therapist: ${reason}`,
      });

      // Queue decline email to assigning admin
      if (adminToNotify) {
        await queueEmail(tx as any, {
          toEmail: adminToNotify.email,
          toName: adminToNotify.name,
          template: "case_declined",
          payload: {
            adminName: adminToNotify.name,
            therapistName: currentUser.name,
            caseNumber: targetCase.caseNumber,
            caseId,
            reason,
          },
        });
      }
    });

    triggerOpportunisticQueueProcess();

    revalidatePath("/admin/cases");
    revalidatePath(`/admin/cases/${caseId}`);
    revalidatePath("/therapist/dashboard");
    revalidatePath(`/therapist/cases/${caseId}`);

    return { success: true, data: { id: caseId } };
  } catch (error) {
    console.error("Failed to decline case:", error);
    return {
      success: false,
      error: "An unexpected error occurred while declining the case.",
    };
  }
}

/**
 * Therapist / Admin: Update Case Status.
 * Enforces valid transition logic.
 */
export async function updateCaseStatusAction(
  rawInput: UpdateCaseStatusInput
): Promise<ActionResponse<{ id: string; status: CaseStatus }>> {
  const currentUser = await requireRole("therapist", "admin", "super_admin");

  const parsed = updateCaseStatusSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { caseId, status: newStatus, notes } = parsed.data;

  try {
    const [targetCase] = await db
      .select({
        id: cases.id,
        status: cases.status,
        currentTherapistId: cases.currentTherapistId,
      })
      .from(cases)
      .where(eq(cases.id, caseId))
      .limit(1);

    if (!targetCase) {
      return { success: false, error: "Case not found." };
    }

    // If therapist, ensure assigned
    if (
      currentUser.role === "therapist" &&
      targetCase.currentTherapistId !== currentUser.id
    ) {
      return { success: false, error: "You are not assigned to this case." };
    }

    // Validate transition
    const currentStatus = targetCase.status;
    const allowedTransitions: Record<CaseStatus, CaseStatus[]> = {
      new: ["assigned"],
      assigned: ["accepted", "new"],
      accepted: ["in_progress"],
      in_progress: ["on_hold", "completed"],
      on_hold: ["in_progress", "completed", "active"],
      completed: [],
      active: ["completed", "on_hold"],
    };

    if (
      currentUser.role === "therapist" &&
      !allowedTransitions[currentStatus]?.includes(newStatus)
    ) {
      return {
        success: false,
        error: `Cannot transition from '${currentStatus}' to '${newStatus}'.`,
      };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(cases)
        .set({ status: newStatus })
        .where(eq(cases.id, caseId));

      await recordEvent(tx, {
        eventType: "status_changed",
        actorId: currentUser.id,
        actorRole: currentUser.role,
        caseId,
        fromStatus: currentStatus,
        toStatus: newStatus,
        metadata: { notes: notes ?? null },
      });

      if (notes && notes.trim().length > 0) {
        await tx.insert(caseNotes).values({
          caseId,
          authorId: currentUser.id,
          note: `Status updated to ${newStatus}: ${notes.trim()}`,
        });

        await recordEvent(tx, {
          eventType: "note_added",
          actorId: currentUser.id,
          actorRole: currentUser.role,
          caseId,
          metadata: { noteSnippet: notes.trim().slice(0, 50) },
        });
      }
    });

    revalidatePath("/admin/cases");
    revalidatePath(`/admin/cases/${caseId}`);
    revalidatePath("/therapist/dashboard");
    revalidatePath(`/therapist/cases/${caseId}`);

    return { success: true, data: { id: caseId, status: newStatus } };
  } catch (error) {
    console.error("Failed to update case status:", error);
    return {
      success: false,
      error: "An unexpected error occurred while updating status.",
    };
  }
}

/**
 * Therapist / Admin: Close Case with required outcome.
 */
export async function closeCaseAction(
  rawInput: CloseCaseInput
): Promise<ActionResponse<{ id: string }>> {
  const currentUser = await requireRole("therapist", "admin", "super_admin");

  const parsed = closeCaseSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { caseId, outcome, closingNotes } = parsed.data;

  try {
    const [targetCase] = await db
      .select({
        id: cases.id,
        caseNumber: cases.caseNumber,
        status: cases.status,
        currentTherapistId: cases.currentTherapistId,
        createdBy: cases.createdBy,
      })
      .from(cases)
      .where(eq(cases.id, caseId))
      .limit(1);

    if (!targetCase) {
      return { success: false, error: "Case not found." };
    }

    if (
      currentUser.role === "therapist" &&
      targetCase.currentTherapistId !== currentUser.id
    ) {
      return { success: false, error: "You are not assigned to this case." };
    }

    const closedAt = new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(cases)
        .set({
          status: "completed",
          outcome,
          closedAt,
        })
        .where(eq(cases.id, caseId));

      await recordEvent(tx, {
        eventType: "case_closed",
        actorId: currentUser.id,
        actorRole: currentUser.role,
        caseId,
        fromStatus: targetCase.status,
        toStatus: "completed",
        metadata: {
          outcome,
          closingNotes: closingNotes ?? null,
          closedAt: closedAt.toISOString(),
        },
      });

      if (closingNotes && closingNotes.trim().length > 0) {
        await tx.insert(caseNotes).values({
          caseId,
          authorId: currentUser.id,
          note: `Case closed (${outcome}): ${closingNotes.trim()}`,
        });

        await recordEvent(tx, {
          eventType: "note_added",
          actorId: currentUser.id,
          actorRole: currentUser.role,
          caseId,
          metadata: { noteSnippet: closingNotes.trim().slice(0, 50) },
        });
      }

      // Notify creating admin, assigning admin, and Super Admins (in-app + outbox email)
      await notifyCaseClosed({
        tx,
        caseId,
        caseNumber: targetCase.caseNumber,
        outcome,
        therapistName: currentUser.name,
        createdById: targetCase.createdBy,
        closedAt,
      });
    });

    triggerOpportunisticQueueProcess();

    revalidatePath("/admin/cases");
    revalidatePath(`/admin/cases/${caseId}`);
    revalidatePath("/admin/rooms");
    revalidatePath("/admin/dashboard");
    revalidatePath("/therapist/dashboard");
    revalidatePath(`/therapist/cases/${caseId}`);

    return { success: true, data: { id: caseId } };
  } catch (error) {
    console.error("Failed to close case:", error);
    return {
      success: false,
      error: "An unexpected error occurred while closing the case.",
    };
  }
}

/**
 * Add a clinical or administrative Note to a case.
 */
export async function addNoteAction(
  rawInput: AddNoteInput
): Promise<ActionResponse<{ id: string }>> {
  const currentUser = await requireRole("therapist", "admin", "super_admin");

  const parsed = addNoteSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { caseId, note, isPrivate } = parsed.data;

  try {
    const [targetCase] = await db
      .select({ id: cases.id, currentTherapistId: cases.currentTherapistId })
      .from(cases)
      .where(eq(cases.id, caseId))
      .limit(1);

    if (!targetCase) {
      return { success: false, error: "Case not found." };
    }

    if (
      currentUser.role === "therapist" &&
      targetCase.currentTherapistId !== currentUser.id
    ) {
      return { success: false, error: "You are not assigned to this case." };
    }

    const noteRecord = await db.transaction(async (tx) => {
      const [newNote] = await tx
        .insert(caseNotes)
        .values({
          caseId,
          authorId: currentUser.id,
          note: note.trim(),
        })
        .returning({ id: caseNotes.id });

      await recordEvent(tx, {
        eventType: "note_added",
        actorId: currentUser.id,
        actorRole: currentUser.role,
        caseId,
        metadata: {
          isPrivate,
          noteSnippet: note.trim().slice(0, 50),
        },
      });

      return newNote;
    });

    revalidatePath(`/admin/cases/${caseId}`);
    revalidatePath(`/therapist/cases/${caseId}`);

    return { success: true, data: { id: noteRecord.id } };
  } catch (error) {
    console.error("Failed to add note:", error);
    return {
      success: false,
      error: "An unexpected error occurred while adding note.",
    };
  }
}

/**
 * Schedule a therapy Session.
 */
export async function scheduleSessionAction(
  rawInput: ScheduleSessionInput
): Promise<ActionResponse<{ id: string }>> {
  const currentUser = await requireRole("therapist", "admin", "super_admin");

  const parsed = scheduleSessionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { caseId, scheduledAt, durationMinutes, notes } = parsed.data;

  try {
    const [targetCase] = await db
      .select({
        id: cases.id,
        caseNumber: cases.caseNumber,
        status: cases.status,
        currentTherapistId: cases.currentTherapistId,
      })
      .from(cases)
      .where(eq(cases.id, caseId))
      .limit(1);

    if (!targetCase) {
      return { success: false, error: "Case not found." };
    }

    const therapistId =
      currentUser.role === "therapist"
        ? currentUser.id
        : (parsed.data.therapistId || targetCase.currentTherapistId);

    if (!therapistId) {
      return {
        success: false,
        error: "Cannot schedule session on a case with no assigned therapist.",
      };
    }

    const sessionRecord = await db.transaction(async (tx) => {
      const [newSession] = await tx
        .insert(sessions)
        .values({
          caseId,
          therapistId,
          scheduledAt: new Date(scheduledAt),
          status: "scheduled",
          notes: notes ?? null,
        })
        .returning({ id: sessions.id });

      await recordEvent(tx, {
        eventType: "session_scheduled",
        actorId: currentUser.id,
        actorRole: currentUser.role,
        caseId,
        metadata: {
          sessionId: newSession.id,
          scheduledAt,
          durationMinutes,
          therapistId,
          roomNo: parsed.data.roomNo ?? null,
        },
      });

      // Optional room assignment on session date
      if (parsed.data.roomNo && parsed.data.roomNo.trim()) {
        const sessionDateStr = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(scheduledAt));

        await tx
          .insert(therapistRoomAssignments)
          .values({
            therapistId,
            assignedDate: sessionDateStr,
            roomNo: parsed.data.roomNo.trim(),
            createdBy: currentUser.id,
          })
          .onConflictDoUpdate({
            target: [
              therapistRoomAssignments.therapistId,
              therapistRoomAssignments.assignedDate,
            ],
            set: {
              roomNo: parsed.data.roomNo.trim(),
              createdBy: currentUser.id,
            },
          });

        await recordEvent(tx, {
          eventType: "room_assigned",
          actorId: currentUser.id,
          actorRole: currentUser.role,
          targetUserId: therapistId,
          metadata: {
            therapistId,
            assignedDate: sessionDateStr,
            roomNo: parsed.data.roomNo.trim(),
            source: "session_scheduling",
          },
        });
      }

      // Queue session scheduled notification to therapist
      const [therapistUser] = await tx
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, therapistId))
        .limit(1);

      if (therapistUser) {
        await queueEmail(tx as any, {
          toEmail: therapistUser.email,
          toName: therapistUser.name,
          template: "session_scheduled",
          payload: {
            therapistName: therapistUser.name,
            caseNumber: targetCase.caseNumber,
            scheduledAt: new Date(scheduledAt).toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
            }),
            caseId,
          },
        });
      }

      return newSession;
    });

    triggerOpportunisticQueueProcess();

    revalidatePath(`/admin/cases/${caseId}`);
    revalidatePath(`/therapist/cases/${caseId}`);
    revalidatePath("/therapist/dashboard");

    return { success: true, data: { id: sessionRecord.id } };
  } catch (error) {
    console.error("Failed to schedule session:", error);
    return {
      success: false,
      error: "An unexpected error occurred while scheduling session.",
    };
  }
}

/**
 * Update Session Status (held, missed, cancelled).
 */
export async function updateSessionStatusAction(
  rawInput: UpdateSessionStatusInput
): Promise<ActionResponse<{ id: string }>> {
  const currentUser = await requireRole("therapist", "admin", "super_admin");

  const parsed = updateSessionStatusSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { sessionId, status, notes } = parsed.data;

  try {
    const [existingSession] = await db
      .select({
        id: sessions.id,
        caseId: sessions.caseId,
        therapistId: sessions.therapistId,
        status: sessions.status,
      })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!existingSession) {
      return { success: false, error: "Session not found." };
    }

    if (
      currentUser.role === "therapist" &&
      existingSession.therapistId !== currentUser.id
    ) {
      return { success: false, error: "You are not the therapist for this session." };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(sessions)
        .set({
          status,
          notes: notes ?? undefined,
        })
        .where(eq(sessions.id, sessionId));

      await recordEvent(tx, {
        eventType: `session_${status}`,
        actorId: currentUser.id,
        actorRole: currentUser.role,
        caseId: existingSession.caseId,
        metadata: {
          sessionId,
          previousStatus: existingSession.status,
          newStatus: status,
          notes: notes ?? null,
        },
      });
    });

    revalidatePath(`/admin/cases/${existingSession.caseId}`);
    revalidatePath(`/therapist/cases/${existingSession.caseId}`);
    revalidatePath("/therapist/dashboard");

    return { success: true, data: { id: sessionId } };
  } catch (error) {
    console.error("Failed to update session status:", error);
    return {
      success: false,
      error: "An unexpected error occurred while updating session.",
    };
  }
}
