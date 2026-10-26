import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { neon } from "@neondatabase/serverless";

const SESSION_COOKIE_NAME = "gcs_session";

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return new TextEncoder().encode(
      "gcs_dev_fallback_secret_key_at_least_32_characters_long_123"
    );
  }
  return new TextEncoder().encode(secret);
}

interface DecodedSession {
  userId: string;
  email: string;
  name: string;
  role: "super_admin" | "admin" | "therapist";
  mustChangePassword: boolean;
  isActive: boolean;
  sessionVersion?: number;
}

function getRoleDashboard(role: string): string {
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  let session: DecodedSession | null = null;

  if (sessionCookie) {
    try {
      const { payload } = await jwtVerify(sessionCookie, getSecretKey());
      session = payload as unknown as DecodedSession;
    } catch {
      // Invalid or expired token
      session = null;
    }
  }

  // Handle Root "/"
  if (pathname === "/") {
    if (session) {
      if (session.mustChangePassword) {
        return NextResponse.redirect(new URL("/change-password", request.url));
      }
      return NextResponse.redirect(
        new URL(getRoleDashboard(session.role), request.url)
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Handle /forgot-password and /reset-password (removed/hidden per spec)
  if (pathname === "/forgot-password" || pathname.startsWith("/reset-password")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Handle /login
  if (pathname === "/login") {
    if (session && session.isActive) {
      if (session.mustChangePassword) {
        return NextResponse.redirect(new URL("/change-password", request.url));
      }
      const redirectParam = request.nextUrl.searchParams.get("redirect");
      if (redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")) {
        return NextResponse.redirect(new URL(redirectParam, request.url));
      }
      return NextResponse.redirect(
        new URL(getRoleDashboard(session.role), request.url)
      );
    }
    return NextResponse.next();
  }

  // For protected routes, require valid session
  const isProtectedPath =
    pathname.startsWith("/super-admin") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/therapist") ||
    pathname.startsWith("/change-password");

  if (isProtectedPath) {
    if (!session || !session.isActive) {
      const loginUrl = new URL("/login", request.url);
      if (sessionCookie) {
        loginUrl.searchParams.set("error", "access_removed");
      } else {
        loginUrl.searchParams.set(
          "redirect",
          pathname + (request.nextUrl.search || "")
        );
      }
      const response = NextResponse.redirect(loginUrl);
      if (sessionCookie) {
        // Clear invalid or deactivated session cookie
        response.cookies.delete(SESSION_COOKIE_NAME);
      }
      return response;
    }

    // Verify session safety in database
    try {
      const dbUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
      if (dbUrl) {
        const sql = neon(dbUrl);
        const rows = await sql`
          SELECT is_active, deleted_at, session_version 
          FROM users 
          WHERE id = ${session.userId} 
          LIMIT 1
        `;

        if (
          rows.length === 0 ||
          !rows[0].is_active ||
          rows[0].deleted_at !== null ||
          (session.sessionVersion !== undefined && rows[0].session_version !== session.sessionVersion)
        ) {
          const loginUrl = new URL("/login", request.url);
          loginUrl.searchParams.set("error", "access_removed");
          const response = NextResponse.redirect(loginUrl);
          response.cookies.delete(SESSION_COOKIE_NAME);
          return response;
        }
      }
    } catch (e) {
      console.error("Middleware DB check error:", e);
    }

    // If user must change password, force redirect to /change-password
    if (session.mustChangePassword) {
      if (pathname !== "/change-password") {
        return NextResponse.redirect(new URL("/change-password", request.url));
      }
      return NextResponse.next();
    }

    // Role-based route protection
    if (pathname.startsWith("/super-admin") && session.role !== "super_admin") {
      return NextResponse.redirect(
        new URL(getRoleDashboard(session.role), request.url)
      );
    }

    if (pathname.startsWith("/admin") && session.role !== "admin") {
      const isSharedAdminRoute =
        session.role === "super_admin" &&
        (pathname.startsWith("/admin/therapists") ||
          pathname.startsWith("/admin/cases"));

      if (!isSharedAdminRoute) {
        return NextResponse.redirect(
          new URL(getRoleDashboard(session.role), request.url)
        );
      }
    }

    if (pathname.startsWith("/therapist") && session.role !== "therapist") {
      return NextResponse.redirect(
        new URL(getRoleDashboard(session.role), request.url)
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/forgot-password",
    "/reset-password",
    "/change-password",
    "/super-admin/:path*",
    "/admin/:path*",
    "/therapist/:path*",
  ],
};
