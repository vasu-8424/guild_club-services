"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  signSessionToken,
  setSessionCookie,
  deleteSessionCookie,
  getRoleDashboardPath,
  verifySessionToken,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { recordEvent } from "@/lib/events";
import {
  loginSchema,
  changePasswordSchema,
  type LoginInput,
  type ChangePasswordInput,
} from "@/lib/validators";
import { cookies } from "next/headers";

export interface AuthActionResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  redirectTo?: string;
}

/**
 * Server Action for authenticating users.
 * Validates with Zod, applies rate limiting, checks active status, hashes with bcrypt.
 */
export async function loginAction(data: LoginInput): Promise<AuthActionResult> {
  // 1. Zod Validation
  const parsed = loginSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    parsed.error.issues.forEach((err) => {
      const field = String(err.path[0] || "form");
      fieldErrors[field] = err.message;
    });
    return {
      success: false,
      error: "Please correct the errors in the form.",
      fieldErrors,
    };
  }

  const { email, password } = parsed.data;

  // 2. Login Rate Limiting (per email and IP)
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : "unknown-ip";
  const rateLimitKey = `login:${clientIp}:${email}`;

  const rateCheck = checkRateLimit(rateLimitKey, { limit: 5, windowMs: 15 * 60 * 1000 });
  if (!rateCheck.success) {
    const minutesLeft = Math.ceil((rateCheck.resetAt - Date.now()) / 60000);
    return {
      success: false,
      error: `Too many failed login attempts. Please try again in ${minutesLeft} minute${
        minutesLeft === 1 ? "" : "s"
      }.`,
    };
  }

  try {
    // 3. User lookup
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user || user.deletedAt !== null) {
      return {
        success: false,
        error: "Invalid email or password.",
      };
    }

    // 4. Password verification first (prevents email enumeration for deactivated accounts)
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return {
        success: false,
        error: "Invalid email or password.",
      };
    }

    // 5. Deactivated user check (only shown if credentials are correct)
    if (!user.isActive) {
      return {
        success: false,
        error: "Your account is deactivated, contact your administrator.",
      };
    }

    // Reset rate limit counter on successful credentials
    resetRateLimit(rateLimitKey);

    // 6. Create session JWT and set secure httpOnly cookie
    const token = await signSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      isActive: user.isActive,
      sessionVersion: user.sessionVersion,
    });

    await setSessionCookie(token);

    // 7. Route to destination based on password change status or role
    const destination = user.mustChangePassword
      ? "/change-password"
      : getRoleDashboardPath(user.role);

    return {
      success: true,
      redirectTo: destination,
    };
  } catch (error) {
    console.error("Login action failure:", error);
    return {
      success: false,
      error: "An unexpected error occurred during login. Please try again.",
    };
  }
}

/**
 * Server Action for mandatory / user password change.
 * Forces users with mustChangePassword=true to set a secure password.
 */
export async function changePasswordAction(
  data: ChangePasswordInput
): Promise<AuthActionResult> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    return {
      success: false,
      error: "Session expired. Please log in again.",
      redirectTo: "/login",
    };
  }

  const session = await verifySessionToken(sessionCookie.value);
  if (!session || !session.userId) {
    return {
      success: false,
      error: "Invalid session. Please log in again.",
      redirectTo: "/login",
    };
  }

  // 1. Zod Validation
  const parsed = changePasswordSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    parsed.error.issues.forEach((err) => {
      const field = String(err.path[0] || "form");
      fieldErrors[field] = err.message;
    });
    return {
      success: false,
      error: "Please correct the errors in the form.",
      fieldErrors,
    };
  }

  const { currentPassword, newPassword } = parsed.data;

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (!user || !user.isActive) {
      await deleteSessionCookie();
      return {
        success: false,
        error: "User account not found or deactivated.",
        redirectTo: "/login",
      };
    }

    // Verify current password
    const isCurrentValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );
    if (!isCurrentValid) {
      return {
        success: false,
        fieldErrors: {
          currentPassword: "The current password entered is incorrect.",
        },
        error: "The current password entered is incorrect.",
      };
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    const newSessionVersion = (user.sessionVersion || 1) + 1;

    // Update inside a transaction and log audit event using recordEvent
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          passwordHash: newHash,
          mustChangePassword: false,
          sessionVersion: newSessionVersion,
        })
        .where(eq(users.id, user.id));

      await recordEvent(tx, {
        eventType: "user_password_changed",
        actorId: user.id,
        actorRole: user.role,
        targetUserId: user.id,
        metadata: {
          mandatoryChangeCompleted: user.mustChangePassword,
          timestamp: new Date().toISOString(),
        },
      });
    });

    // Update active session cookie with mustChangePassword = false and new session version
    const updatedToken = await signSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mustChangePassword: false,
      isActive: user.isActive,
      sessionVersion: newSessionVersion,
    });

    await setSessionCookie(updatedToken);

    return {
      success: true,
      redirectTo: getRoleDashboardPath(user.role),
    };
  } catch (error) {
    console.error("Change password error:", error);
    return {
      success: false,
      error: "An error occurred while updating your password. Please try again.",
    };
  }
}

/**
 * Server Action for signing out.
 */
export async function logoutAction() {
  await deleteSessionCookie();
  redirect("/login");
}
