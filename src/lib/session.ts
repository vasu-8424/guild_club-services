import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type UserRole } from "@/db/schema";
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
  deleteSessionCookie,
  getRoleDashboardPath,
} from "./auth";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  temporaryPasswordPrompt: boolean;
  deletedAt: Date | null;
  sessionVersion: number;
  loginRecordId?: string | null;
}

/**
 * Retrieves the currently authenticated user from the session cookie,
 * verifying the JWT and checking current database status.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    return null;
  }

  const payload = await verifySessionToken(sessionCookie.value);
  if (!payload || !payload.userId) {
    return null;
  }

  // Fetch the latest state from the database
  try {
    const [dbUser] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        isActive: users.isActive,
        mustChangePassword: users.mustChangePassword,
        temporaryPasswordPrompt: users.temporaryPasswordPrompt,
        deletedAt: users.deletedAt,
        sessionVersion: users.sessionVersion,
      })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (
      !dbUser ||
      !dbUser.isActive ||
      dbUser.deletedAt !== null ||
      (payload.sessionVersion !== undefined && dbUser.sessionVersion !== payload.sessionVersion)
    ) {
      await deleteSessionCookie();
      return null;
    }

    return {
      ...dbUser,
      loginRecordId: payload.loginRecordId || null,
    };
  } catch (error) {
    console.error("Failed to fetch current user from database:", error);
    return null;
  }
}

/**
 * Server authorization helper.
 * EVERY API route, server action, and protected page component must call this.
 *
 * Rules:
 * 1. If not authenticated, deleted, or session version mismatch -> clear session and redirect to /login?error=access_removed
 * 2. If deactivated -> clear session and redirect to /login?error=account_deactivated
 * 3. If mustChangePassword is true -> redirect to /change-password
 * 4. If current role is not in the allowed roles -> redirect to own role's dashboard
 *
 * @param allowedRoles - List of authorized roles (e.g., "super_admin", "admin", "therapist")
 * @returns CurrentUser
 */
export async function requireRole(...allowedRoles: UserRole[]): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) {
    await deleteSessionCookie();
    redirect("/login?error=access_removed");
  }

  if (!user.isActive || user.deletedAt !== null) {
    await deleteSessionCookie();
    redirect("/login?error=access_removed");
  }

  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    // Redirect unauthorized role to their designated dashboard
    const ownDashboard = getRoleDashboardPath(user.role);
    redirect(ownDashboard);
  }

  return user;
}

/**
 * API route authorization helper.
 * Returns 401 if unauthenticated/deleted/inactive, 403 if role unauthorized, or { user }.
 */
export async function requireApiRole(
  ...allowedRoles: UserRole[]
): Promise<{ user: CurrentUser; errorResponse?: never } | { user?: never; errorResponse: Response }> {
  const user = await getCurrentUser();

  if (!user || !user.isActive || user.deletedAt !== null) {
    return {
      errorResponse: new Response(
        JSON.stringify({ error: "Your access has been removed." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return {
      errorResponse: new Response(
        JSON.stringify({ error: "Forbidden. Insufficient permissions." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  return { user };
}
