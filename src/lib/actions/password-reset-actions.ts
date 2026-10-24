"use server";

import bcrypt from "bcryptjs";
import { eq, and, isNull, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, passwordResetTokens } from "@/db/schema";
import { recordEvent } from "@/lib/events";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type ResetPasswordInput,
} from "@/lib/validators";

export type PasswordResetResponse = {
  success: boolean;
  message?: string;
  error?: string;
};

/**
 * Public forgot-password flow is removed per specification.
 * Passwords are now managed directly by account creators/administrators.
 */
export async function requestPasswordResetAction(
  _rawInput: ForgotPasswordInput
): Promise<PasswordResetResponse> {
  return {
    success: false,
    error: "Password reset via email is disabled. Please contact your administrator.",
  };
}

/**
 * Reset password using a valid, unexpired token (legacy support).
 */
export async function resetPasswordWithTokenAction(
  rawInput: ResetPasswordInput
): Promise<PasswordResetResponse> {
  const parsed = resetPasswordSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { token, password } = parsed.data;

  try {
    const [tokenRecord] = await db
      .select({
        id: passwordResetTokens.id,
        userId: passwordResetTokens.userId,
        expiresAt: passwordResetTokens.expiresAt,
        usedAt: passwordResetTokens.usedAt,
      })
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!tokenRecord) {
      return {
        success: false,
        error: "This password reset link is invalid or has expired.",
      };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          passwordHash,
          mustChangePassword: false,
          sessionVersion: sql`COALESCE(${users.sessionVersion}, 1) + 1`,
        })
        .where(eq(users.id, tokenRecord.userId));

      await tx
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, tokenRecord.id));

      await recordEvent(tx, {
        eventType: "password_reset_completed",
        actorId: tokenRecord.userId,
        actorRole: "user",
        targetUserId: tokenRecord.userId,
      });
    });

    return {
      success: true,
      message: "Your password has been successfully reset. You may now sign in.",
    };
  } catch (error) {
    console.error("Failed to reset password:", error);
    return {
      success: false,
      error: "An unexpected error occurred while resetting your password.",
    };
  }
}

export const resetPasswordAction = resetPasswordWithTokenAction;
