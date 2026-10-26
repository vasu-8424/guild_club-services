"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { and, eq, ne, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, caseEvents } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { recordEvent } from "@/lib/events";
import { queueEmail } from "@/lib/email";
import { triggerOpportunisticQueueProcess } from "@/lib/notifications";
import {
  createAdminSchema,
  editAdminSchema,
  toggleUserStatusSchema,
  resetUserPasswordSchema,
  deleteUserSchema,
  type CreateAdminInput,
  type EditAdminInput,
  type ToggleUserStatusInput,
  type ResetUserPasswordInput,
  type DeleteUserInput,
} from "@/lib/validators";

export type ActionResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

/**
 * Super Admin: Create a new Admin account.
 * - Password entered manually by Super Admin
 * - Hashes password with bcrypt (never stored or logged in plain text)
 * - mustChangePassword = false
 * - No credentials email is sent (creator shares details directly)
 * - Records admin_created event in the same transaction
 */
import { sendCredentialsDirect } from "@/lib/notifications/credentials-sender";
import { getEmailQuotaUsage } from "@/lib/notifications/quota";
import crypto from "crypto";

export async function createAdminAction(
  rawInput: CreateAdminInput
): Promise<ActionResponse<{ id: string; email: string; emailWarning?: string }>> {
  const currentUser = await requireRole("super_admin");

  const parsed = createAdminSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { name, email, phone, password, emailCredentials = true } = parsed.data;

  // Check if active user with this email already exists (deleted emails are freed for reuse)
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
      const [newAdmin] = await tx
        .insert(users)
        .values({
          name,
          email,
          phone: phone || null,
          passwordHash,
          role: "admin",
          isActive: true,
          mustChangePassword: false,
          temporaryPasswordPrompt: true,
          createdBy: currentUser.id,
          sessionVersion: 1,
        })
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
        });

      // Record audit event (WITHOUT PLAIN PASSWORD)
      await recordEvent(tx, {
        eventType: "admin_created",
        actorId: currentUser.id,
        actorRole: currentUser.role,
        targetUserId: newAdmin.id,
        metadata: {
          email,
          name,
          role: "admin",
        },
      });

      return newAdmin;
    });

    // Send credentials DIRECTLY outside transaction with in-memory password & 5s timeout
    const sendRes = await sendCredentialsDirect({
      userId: result.id,
      toEmail: result.email,
      toName: result.name,
      role: "admin",
      createdByName: currentUser.name,
      password,
      emailCredentials,
    });

    revalidatePath("/super-admin/admins");

    return {
      success: true,
      data: {
        id: result.id,
        email: result.email,
        emailWarning: sendRes.error
          ? `Account created, but the email could not be sent: ${sendRes.error}`
          : undefined,
      },
    };
  } catch (error) {
    console.error("Failed to create admin:", error);
    return {
      success: false,
      error: "An unexpected error occurred while creating the admin.",
    };
  }
}

/**
 * Resend Credentials action:
 * - Super Admin can resend for Admin and Therapist.
 * - Admin can resend for Therapist only (403 if target is Admin).
 * - Generates a new temporary password (or uses provided), updates passwordHash,
 *   invalidates existing sessions (sessionVersion++), and sends credentials email directly.
 * - Rate-limited to 3 per hour per target user.
 * - Records user_credentials_resent event.
 */
export async function resendCredentialsAction(rawInput: {
  userId: string;
  password?: string;
}): Promise<ActionResponse<{ newPassword?: string; emailSent: boolean; warning?: string }>> {
  const currentUser = await requireRole("super_admin", "admin");

  const [targetUser] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, rawInput.userId), isNull(users.deletedAt)))
    .limit(1);

  if (!targetUser) {
    return { success: false, error: "User not found" };
  }

  // Security check: Only Super Admins can resend credentials for Admin accounts
  if (targetUser.role === "admin" && currentUser.role !== "super_admin") {
    return {
      success: false,
      error: "Forbidden: Only Super Admins can resend credentials for admin accounts.",
    };
  }

  // Rate limit: max 3 per hour per target user
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [recentCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(caseEvents)
    .where(
      and(
        eq(caseEvents.targetUserId, targetUser.id),
        eq(caseEvents.eventType, "user_credentials_resent"),
        sql`${caseEvents.occurredAt} >= ${oneHourAgo}`
      )
    );

  const resentCount = recentCountRow?.count ?? 0;
  if (resentCount >= 3) {
    return {
      success: false,
      error: "Rate limit reached: Credentials can only be resent up to 3 times per hour for this user.",
    };
  }

  // Quota check
  const quota = await getEmailQuotaUsage();
  if (quota.isDailyExceeded || quota.isMonthlyExceeded) {
    return {
      success: false,
      error: "Daily email quota reached (90 emails/day). Cannot send credentials email. Please share credentials manually or resend later.",
    };
  }

  // Generate or use specified password
  const newPassword =
    rawInput.password && rawInput.password.trim().length >= 8
      ? rawInput.password.trim()
      : crypto.randomBytes(6).toString("hex") + "A1!";

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        passwordHash,
        sessionVersion: sql`${users.sessionVersion} + 1`,
        temporaryPasswordPrompt: true,
        mustChangePassword: false,
      })
      .where(eq(users.id, targetUser.id));

    await recordEvent(tx, {
      eventType: "user_credentials_resent",
      actorId: currentUser.id,
      actorRole: currentUser.role,
      targetUserId: targetUser.id,
      metadata: {
        email: targetUser.email,
        role: targetUser.role,
      },
    });
  });

  // Send credentials email directly with in-memory password
  const sendRes = await sendCredentialsDirect({
    userId: targetUser.id,
    toEmail: targetUser.email,
    toName: targetUser.name,
    role: targetUser.role as "admin" | "therapist",
    createdByName: currentUser.name,
    password: newPassword,
    emailCredentials: true,
  });

  revalidatePath("/super-admin/admins");
  revalidatePath("/admin/therapists");

  return {
    success: true,
    data: {
      newPassword,
      emailSent: sendRes.emailSent,
      warning: sendRes.error,
    },
  };
}

/**
 * Super Admin: Edit an existing Admin account.
 * - Allows changing name, phone, and email (must remain unique among active accounts)
 */
export async function editAdminAction(
  rawInput: EditAdminInput
): Promise<ActionResponse<{ id: string }>> {
  const currentUser = await requireRole("super_admin");

  const parsed = editAdminSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { id, name, email, phone } = parsed.data;

  try {
    const [target] = await db
      .select({ id: users.id, role: users.role, email: users.email, deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!target || target.role !== "admin" || target.deletedAt !== null) {
      return {
        success: false,
        error: "Admin account not found or has been deleted.",
      };
    }

    // Verify email uniqueness among other non-deleted users
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
          phone: phone || null,
        })
        .where(eq(users.id, id));

      await recordEvent(tx, {
        eventType: "admin_updated",
        actorId: currentUser.id,
        actorRole: currentUser.role,
        targetUserId: id,
        metadata: { name, email, phone },
      });
    });

    revalidatePath("/super-admin/admins");
    revalidatePath(`/super-admin/admins/${id}`);

    return {
      success: true,
      data: { id },
    };
  } catch (error) {
    console.error("Failed to update admin:", error);
    return {
      success: false,
      error: "An unexpected error occurred while updating the admin.",
    };
  }
}

/**
 * Super Admin: Reset an Admin password.
 * - Updates password hash
 * - Increments session_version immediately to kick out active sessions
 * - Records user_password_reset event
 */
export async function resetAdminPasswordAction(
  rawInput: ResetUserPasswordInput
): Promise<ActionResponse<{ id: string }>> {
  const currentUser = await requireRole("super_admin");

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
        name: users.name,
        role: users.role,
        email: users.email,
        deletedAt: users.deletedAt,
        sessionVersion: users.sessionVersion,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!target || target.deletedAt !== null) {
      return {
        success: false,
        error: "User account not found or has been deleted.",
      };
    }

    if (target.role !== "admin" && target.role !== "therapist") {
      return {
        success: false,
        error: "Can only reset password for admin or therapist accounts.",
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

      // Queue password reset notification (without password)
      await queueEmail(tx as any, {
        toEmail: target.email,
        toName: target.name,
        template: "password_reset",
        payload: {
          recipientName: target.name,
          loginId: target.email,
          resetByName: currentUser.name,
        },
      });
    });

    triggerOpportunisticQueueProcess();

    revalidatePath("/super-admin/admins");
    revalidatePath(`/super-admin/admins/${userId}`);

    return {
      success: true,
      data: { id: userId },
    };
  } catch (error) {
    console.error("Failed to reset password:", error);
    return {
      success: false,
      error: "An unexpected error occurred while resetting the password.",
    };
  }
}

/**
 * Super Admin: Soft Delete an Admin account.
 * - Requires typing email to confirm
 * - Cannot delete self or super_admin
 * - Sets deleted_at = NOW(), is_active = false, increments session_version
 * - Records user_deleted event
 */
export async function deleteAdminAction(
  rawInput: DeleteUserInput
): Promise<ActionResponse<{ id: string }>> {
  const currentUser = await requireRole("super_admin");

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
        sessionVersion: users.sessionVersion,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!target || target.deletedAt !== null) {
      return {
        success: false,
        error: "User not found or already deleted.",
      };
    }

    if (target.role === "super_admin") {
      return {
        success: false,
        error: "Super Admin accounts cannot be deleted.",
      };
    }

    if (confirmEmail.trim().toLowerCase() !== target.email.toLowerCase()) {
      return {
        success: false,
        error: "Confirmation email does not match user email.",
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

    revalidatePath("/super-admin/admins");
    revalidatePath(`/super-admin/admins/${userId}`);

    return {
      success: true,
      data: { id: userId },
    };
  } catch (error) {
    console.error("Failed to delete admin:", error);
    return {
      success: false,
      error: "An unexpected error occurred while deleting the admin.",
    };
  }
}

/**
 * Super Admin: Activate or Deactivate an Admin account (temporary block).
 */
export async function toggleAdminStatusAction(
  rawInput: ToggleUserStatusInput
): Promise<ActionResponse<{ id: string; isActive: boolean }>> {
  const currentUser = await requireRole("super_admin");

  const parsed = toggleUserStatusSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { userId, isActive } = parsed.data;

  if (userId === currentUser.id) {
    return {
      success: false,
      error: "You cannot deactivate your own account.",
    };
  }

  try {
    const [target] = await db
      .select({ id: users.id, role: users.role, isActive: users.isActive, deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!target || target.deletedAt !== null) {
      return {
        success: false,
        error: "User not found or has been deleted.",
      };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          isActive,
          // Increment session version on deactivation so existing sessions expire immediately
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
          targetRole: target.role,
        },
      });
    });

    revalidatePath("/super-admin/admins");
    revalidatePath(`/super-admin/admins/${userId}`);

    return {
      success: true,
      data: { id: userId, isActive },
    };
  } catch (error) {
    console.error("Failed to toggle admin status:", error);
    return {
      success: false,
      error: "An unexpected error occurred while changing account status.",
    };
  }
}
