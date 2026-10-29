import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { UserRole } from "@/db/schema";

export const SESSION_COOKIE_NAME = "gcs_session";
const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60; // 7 days

const getSecretKey = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET is not configured in production environment!");
    }
    // Fallback for development only
    return new TextEncoder().encode("gcs_dev_fallback_secret_key_at_least_32_characters_long_123");
  }
  return new TextEncoder().encode(secret);
};

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  mustChangePassword: boolean;
  isActive: boolean;
  sessionVersion: number;
  loginRecordId?: string | null;
}

/**
 * Signs a JWT session token for the authenticated user.
 */
export async function signSessionToken(payload: SessionPayload): Promise<string> {
  const secretKey = getSecretKey();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(secretKey);
}

/**
 * Verifies a JWT session token and returns the payload.
 */
export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const secretKey = getSecretKey();
    const { payload } = await jwtVerify(token, secretKey);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Sets the session token in an HTTP-only, secure cookie.
 */
export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

/**
 * Clears the session cookie.
 */
export async function deleteSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Maps a user's role to their designated dashboard route.
 */
export function getRoleDashboardPath(role: UserRole): string {
  switch (role) {
    case "super_admin":
      return "/super-admin/dashboard";
    case "admin":
      return "/admin/dashboard";
    case "therapist":
      return "/therapist/dashboard";
    default:
      return "/login";
  }
}
