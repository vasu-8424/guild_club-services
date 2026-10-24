import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { recordEvent } from "@/lib/events";
import { getTodayIST } from "@/lib/date-utils";

interface RouteParams {
  params: Promise<{
    sessionId: string;
  }>;
}

function getDateStringIST(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

export async function POST(
  _request: NextRequest,
  { params }: RouteParams
) {
  const user = await getCurrentUser();

  if (!user || !user.isActive || user.deletedAt !== null) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  if (user.role !== "therapist") {
    return NextResponse.json(
      { error: "Forbidden: Only assigned therapists can complete sessions." },
      { status: 403 }
    );
  }

  const { sessionId } = await params;

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!session) {
    return NextResponse.json(
      { error: "Session not found." },
      { status: 404 }
    );
  }

  // Ownership check
  if (session.therapistId !== user.id) {
    return NextResponse.json(
      { error: "Forbidden: You are not assigned to this session." },
      { status: 403 }
    );
  }

  if (session.status === "held") {
    return NextResponse.json(
      { error: "Session has already been completed." },
      { status: 400 }
    );
  }

  const today = getTodayIST();
  const sessionDate = getDateStringIST(session.scheduledAt);
  if (sessionDate !== today) {
    return NextResponse.json(
      { error: "Sessions can only be completed on their scheduled date (IST)." },
      { status: 400 }
    );
  }

  // Check all four required artifacts
  if (!session.inTimePhotoKey) {
    return NextResponse.json(
      { error: "Missing required in-time photo." },
      { status: 400 }
    );
  }

  if (!session.workDone || session.workDone.trim().length < 10) {
    return NextResponse.json(
      { error: "Missing required work done description (minimum 10 characters)." },
      { status: 400 }
    );
  }

  if (!session.outTimePhotoKey) {
    return NextResponse.json(
      { error: "Missing required out-time photo." },
      { status: 400 }
    );
  }

  if (!session.patientSignatureKey) {
    return NextResponse.json(
      { error: "Missing required patient signature." },
      { status: 400 }
    );
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(sessions)
      .set({
        status: "held",
        completedAt: now,
      })
      .where(eq(sessions.id, sessionId));

    await recordEvent(tx, {
      eventType: "session_held",
      actorId: user.id,
      actorRole: "therapist",
      caseId: session.caseId,
      metadata: {
        sessionId,
        completedAt: now.toISOString(),
      },
    });
  });

  return NextResponse.json({
    success: true,
    completedAt: now.toISOString(),
  });
}
