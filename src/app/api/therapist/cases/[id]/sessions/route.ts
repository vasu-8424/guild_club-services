import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/session";
import { db } from "@/db";
import { cases, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { recordEvent } from "@/lib/events";
import { scheduleSessionSchema } from "@/lib/validators";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiRole("super_admin", "admin", "therapist");
  if (auth.errorResponse) return auth.errorResponse;

  const { id } = await params;
  const user = auth.user;

  try {
    const body = await req.json();
    const parsed = scheduleSessionSchema.safeParse({ caseId: id, ...body });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid session input" },
        { status: 400 }
      );
    }

    const [targetCase] = await db
      .select()
      .from(cases)
      .where(eq(cases.id, id))
      .limit(1);

    if (!targetCase) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    if (user.role === "therapist" && targetCase.currentTherapistId !== user.id) {
      return NextResponse.json({ error: "Forbidden: Not assigned to this case" }, { status: 403 });
    }

    if (user.role === "therapist" && targetCase.status === "completed") {
      return NextResponse.json({ error: "Cannot schedule sessions on a completed case" }, { status: 400 });
    }

    let sessionId: string = "";
    await db.transaction(async (tx) => {
      const [newSession] = await tx
        .insert(sessions)
        .values({
          caseId: id,
          therapistId: targetCase.currentTherapistId ?? user.id,
          scheduledAt: new Date(parsed.data.scheduledAt),
          notes: parsed.data.notes,
          status: "scheduled",
        })
        .returning({ id: sessions.id });

      sessionId = newSession.id;

      await recordEvent(tx, {
        eventType: "session_scheduled",
        actorId: user.id,
        actorRole: user.role,
        caseId: id,
        metadata: {
          sessionId,
          scheduledAt: parsed.data.scheduledAt,
          durationMinutes: parsed.data.durationMinutes,
        },
      });
    });

    return NextResponse.json({ success: true, sessionId });
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
