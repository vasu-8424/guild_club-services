"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { and, eq, ne, isNull, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, therapistProfiles, cases } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { recordEvent } from "@/lib/events";
import {
  createTherapistSchema,
  editTherapistSchema,
  toggleUserStatusSchema,
  resetUserPasswordSchema,
  deleteUserSchema,
  type CreateTherapistInput,
  type EditTherapistInput,
  type ToggleUserStatusInput,
  type ResetUserPasswordInput,
  type DeleteUserInput,
} from "@/lib/validators";

export type ActionResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  openCases?: Array<{ id: string; caseNumber: string; status: string }>;
};

/**
 * Admin / Super Admin: Register a new Therapist.
 * - Password typed manually
 * - Hashes password with bcrypt (never stored or logged in plain text)
 * - mustChangePassword = false
 * - No credentials email is sent (creator shares details directly)
 * - Records therapist_registered event in the same transaction
 */
export async function createTherapistAction(
  rawInput: CreateTherapistInput
): Promise<ActionResponse<{ id: string; email: string }>> {
  const currentUser = await requireRole("admin", "super_admin");

  const parsed = createTherapistSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const {
    name,
    email,
    phone,
    specialization,
    experienceYears,
    maxOpenCases,
    password,
  } = parsed.data;

  // Check email uniqueness among non-deleted users
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);

  if (existing) {
    return {
      success: false,
      error: "A user with this email address already exists.",
    };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const result = await db.transaction(async (tx) => {
      const [newTherapist] = await tx
        .insert(users)
        .values({
          name,
          email,
          phone,
          passwordHash,
          role: "therapist",
          isActive: true,
          mustChangePassword: false,
          createdBy: currentUser.id,
          sessionVersion: 1,
        })
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
        });

      await tx.insert(therapistProfiles).values({
        userId: newTherapist.id,
        specialization,
        experienceYears,
        maxOpenCases,
      });

      // Record audit event
      await recordEvent(tx, {
        eventType: "therapist_registered",
        actorId: currentUser.id,
        actorRole: currentUser.role,
        targetUserId: newTherapist.id,
        metadata: {
          specialization,
          experienceYears,
          maxOpenCases,
          email,
          name,
        },
      });

      return newTherapist;
    });

    revalidatePath("/admin/therapists");

    return {
      success: true,
      data: {
        id: result.id,
        email: result.email,
      },
    };
  } catch (error) {
    console.error("Failed to register therapist:", error);
    return {
      success: false,
      error: "An unexpected error occurred while registering the therapist.",
    };
  }
}

/**
 * Admin / Super Admin: Edit therapist profile.
 * - Allows changing name, phone, email, and clinical fields
 */
export async function editTherapistAction(
  rawInput: EditTherapistInput
): Promise<ActionResponse<{ id: string }>> {
  const currentUser = await requireRole("admin", "super_admin");

  const parsed = editTherapistSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { id, name, email, phone, specialization, experienceYears, maxOpenCases } =
    parsed.data;

  try {
    const [target] = await db
      .select({ id: users.id, role: users.role, email: users.email, deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!target || target.role !== "therapist" || target.deletedAt !== null) {
      return {
        success: false,
        error: "Therapist account not found or has been deleted.",
      };
    }

    // Verify email uniqueness among other non-deleted accounts
    if (email !== target.email) {
      const [duplicate] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, email), ne(users.id, id), isNull(users.deletedAt)))
        .limit(1);

      if (duplicate) {
        return {
          success: false,
          error: "A user with this email address already exists.",
        };
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          name,
          email,
          phone,
        })
        .where(eq(users.id, id));

      await tx
        .insert(therapistProfiles)
        .values({
          userId: id,
          specialization,
          experienceYears,
          maxOpenCases,
        })
        .onConflictDoUpdate({
          target: therapistProfiles.userId,
          set: {
            specialization,
            experienceYears,
            maxOpenCases,
          },
        });

      await recordEvent(tx, {
        eventType: "therapist_updated",
        actorId: currentUser.id,
        actorRole: currentUser.role,
        targetUserId: id,
        metadata: {
          specialization,
          experienceYears,
          maxOpenCases,
          email,
          name,
        },
      });
    });

    revalidatePath("/admin/therapists");
    revalidatePath(`/admin/therapists/${id}`);

    return {
      success: true,
      data: { id },
    };
  } catch (error) {
    console.error("Failed to update therapist:", error);
    return {
      success: false,
      error: "An unexpected error occurred while updating the therapist.",
    };
  }
}

/**
 * Admin / Super Admin: Reset a Therapist password.
 * - Old password stops working
 * - Session version incremented immediately to invalidate existing sessions
 * - Records user_password_reset event
 */
export async function resetTherapistPasswordAction(
  rawInput: ResetUserPasswordInput
): Promise<ActionResponse<{ id: string }>> {
  const currentUser = await requireRole("admin", "super_admin");

  const parsed = resetUserPasswordSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { userId, password } = parsed.data;

  try {
    const [target] = await db
      .select({
        id: users.id,
        role: users.role,
        email: users.email,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!target || target.deletedAt !== null) {
      return {
        success: false,
        error: "Therapist account not found or has been deleted.",
      };
    }

    if (target.role !== "therapist") {
      return {
        success: false,
        error: "Can only reset passwords for therapist accounts.",
      };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          passwordHash,
          sessionVersion: sql`COALESCE(${users.sessionVersion}, 1) + 1`,
        })
        .where(eq(users.id, userId));

      await recordEvent(tx, {
        eventType: "user_password_reset",
        actorId: currentUser.id,
        actorRole: currentUser.role,
        targetUserId: userId,
        metadata: {
          targetEmail: target.email,
          targetRole: target.role,
        },
      });
    });

    revalidatePath("/admin/therapists");
    revalidatePath(`/admin/therapists/${userId}`);

    return {
      success: true,
      data: { id: userId },
    };
  } catch (error) {
    console.error("Failed to reset therapist password:", error);
    return {
      success: false,
      error: "An unexpected error occurred while resetting the password.",
    };
  }
}

/**
 * Check open cases for a therapist before deletion.
 */
export async function getTherapistOpenCasesAction(
  therapistId: string
): Promise<{ id: string; caseNumber: string; status: string }[]> {
  await requireRole("admin", "super_admin");

  const openCases = await db
    .select({
      id: cases.id,
      caseNumber: cases.caseNumber,
      status: cases.status,
    })
    .from(cases)
    .where(
      and(
        eq(cases.currentTherapistId, therapistId),
        inArray(cases.status, ["assigned", "accepted", "in_progress", "on_hold"])
      )
    );

  return openCases;
}

/**
 * Admin / Super Admin: Soft Delete a Therapist account.
 * - Requires typing email to confirm
 * - Cannot delete self or super_admin
 * - Blocked if therapist has open cases (assigned, accepted, in_progress, on_hold)
 * - Sets deleted_at = NOW(), is_active = false, increments session_version
 * - Records user_deleted event
 */
export async function deleteTherapistAction(
  rawInput: DeleteUserInput
): Promise<ActionResponse<{ id: string }>> {
  const currentUser = await requireRole("admin", "super_admin");

  const parsed = deleteUserSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { userId, confirmEmail } = parsed.data;

  if (userId === currentUser.id) {
    return {
      success: false,
      error: "You cannot delete your own account.",
    };
  }

  try {
    const [target] = await db
      .select({
        id: users.id,
        role: users.role,
        email: users.email,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!target || target.deletedAt !== null) {
      return {
        success: false,
        error: "Therapist not found or already deleted.",
      };
    }

    if (target.role === "super_admin") {
      return {
        success: false,
        error: "Super Admin accounts cannot be deleted.",
      };
    }

    if (target.role !== "therapist") {
      return {
        success: false,
        error: "This action can only delete therapist accounts.",
      };
    }

    if (confirmEmail.trim().toLowerCase() !== target.email.toLowerCase()) {
      return {
        success: false,
        error: "Confirmation email does not match user email.",
      };
    }

    // Check for open cases: assigned, accepted, in_progress, on_hold
    const openCases = await db
      .select({
        id: cases.id,
        caseNumber: cases.caseNumber,
        status: cases.status,
      })
      .from(cases)
      .where(
        and(
          eq(cases.currentTherapistId, userId),
          inArray(cases.status, ["assigned", "accepted", "in_progress", "on_hold"])
        )
      );

    if (openCases.length > 0) {
      return {
        success: false,
        error: `Cannot delete therapist with ${openCases.length} open case(s). Reassign them first.`,
        openCases,
      };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          deletedAt: new Date(),
          isActive: false,
          sessionVersion: sql`COALESCE(${users.sessionVersion}, 1) + 1`,
        })
        .where(eq(users.id, userId));

      await recordEvent(tx, {
        eventType: "user_deleted",
        actorId: currentUser.id,
        actorRole: currentUser.role,
        targetUserId: userId,
        metadata: {
          targetEmail: target.email,
          targetRole: target.role,
        },
      });
    });

    revalidatePath("/admin/therapists");
    revalidatePath(`/admin/therapists/${userId}`);

    return {
      success: true,
      data: { id: userId },
    };
  } catch (error) {
    console.error("Failed to delete therapist:", error);
    return {
      success: false,
      error: "An unexpected error occurred while deleting the therapist.",
    };
  }
}

/**
 * Admin / Super Admin: Activate or Deactivate therapist account.
 */
export async function toggleTherapistStatusAction(
  rawInput: ToggleUserStatusInput
): Promise<ActionResponse<{ id: string; isActive: boolean }>> {
  const currentUser = await requireRole("admin", "super_admin");

  const parsed = toggleUserStatusSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { userId, isActive } = parsed.data;

  try {
    const [target] = await db
      .select({ id: users.id, role: users.role, isActive: users.isActive, deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!target || target.role !== "therapist" || target.deletedAt !== null) {
      return {
        success: false,
        error: "Therapist account not found or has been deleted.",
      };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          isActive,
          ...(!isActive ? { sessionVersion: sql`COALESCE(${users.sessionVersion}, 1) + 1` } : {}),
        })
        .where(eq(users.id, userId));

      await recordEvent(tx, {
        eventType: isActive ? "user_activated" : "user_deactivated",
        actorId: currentUser.id,
        actorRole: currentUser.role,
        targetUserId: userId,
        metadata: {
          previousStatus: target.isActive,
          newStatus: isActive,
        },
      });
    });

    revalidatePath("/admin/therapists");
    revalidatePath(`/admin/therapists/${userId}`);

    return {
      success: true,
      data: { id: userId, isActive },
    };
  } catch (error) {
    console.error("Failed to toggle therapist status:", error);
    return {
      success: false,
      error: "An unexpected error occurred while changing therapist status.",
    };
  }
}
