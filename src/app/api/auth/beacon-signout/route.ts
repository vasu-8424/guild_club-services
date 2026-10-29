import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { loginRecords } from "@/db/schema";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { eq, desc, and, isNull } from "drizzle-orm";
import { recordEvent } from "@/lib/events";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    if (!sessionCookie?.value) {
      return NextResponse.json({ ok: true });
    }

    const session = await verifySessionToken(sessionCookie.value);
    if (!session?.userId) {
      return NextResponse.json({ ok: true });
    }

    // Find active login record that has not yet signed out
    let targetRecordId = session.loginRecordId;
    if (!targetRecordId) {
      const cookieRecordId = cookieStore.get("gcs_latest_login_id")?.value;
      if (cookieRecordId) {
        targetRecordId = cookieRecordId;
      } else {
        const [latest] = await db
          .select({ id: loginRecords.id })
          .from(loginRecords)
          .where(
            and(
              eq(loginRecords.userId, session.userId),
              isNull(loginRecords.signedOutAt)
            )
          )
          .orderBy(desc(loginRecords.signedInAt))
          .limit(1);
        targetRecordId = latest?.id || null;
      }
    }

    if (targetRecordId) {
      const now = new Date();
      await db
        .update(loginRecords)
        .set({
          signedOutAt: now,
          loggedOutAt: now,
          signOutLocationStatus: "not_captured",
        })
        .where(eq(loginRecords.id, targetRecordId));

      if (session.role === "therapist") {
        await recordEvent(db, {
          eventType: "therapist_signed_out",
          actorId: session.userId,
          actorRole: session.role,
          targetUserId: session.userId,
          metadata: {
            loginRecordId: targetRecordId,
            signOutLocationStatus: "not_captured",
            reason: "tab_closed_or_beacon",
            timestamp: now.toISOString(),
          },
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Beacon signout error:", error);
    return NextResponse.json({ ok: true });
  }
}
