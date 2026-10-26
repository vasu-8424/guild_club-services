import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/session";
import { db } from "@/db";
import { cases, caseNotes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { recordEvent } from "@/lib/events";
import { notifyCaseClosed } from "@/lib/notifications/in-app";
import { closeCaseSchema } from "@/lib/validators";

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
    const parsed = closeCaseSchema.safeParse({ caseId: id, ...body });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid close case input. Outcome is required." },
        { status: 400 }
      );
    }

    const [targetCase] = await db
      .select({
        id: cases.id,
        caseNumber: cases.caseNumber,
        status: cases.status,
        currentTherapistId: cases.currentTherapistId,
        createdBy: cases.createdBy,
      })
      .from(cases)
      .where(eq(cases.id, id))
      .limit(1);

    if (!targetCase) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    if (user.role === "therapist" && targetCase.currentTherapistId !== user.id) {
      return NextResponse.json({ error: "Forbidden: Not assigned to this case" }, { status: 403 });
    }

    if (targetCase.status === "completed") {
      return NextResponse.json({ error: "Case is already completed" }, { status: 400 });
    }

    const closedAt = new Date();
    const { outcome, closingNotes } = parsed.data;

    await db.transaction(async (tx) => {
      await tx
        .update(cases)
        .set({
          status: "completed",
          outcome,
          closedAt,
        })
        .where(eq(cases.id, id));

      await recordEvent(tx, {
        eventType: "case_closed",
        actorId: user.id,
        actorRole: user.role,
        caseId: id,
        fromStatus: targetCase.status,
        toStatus: "completed",
        metadata: {
          outcome,
          closingNotes: closingNotes ?? null,
          closedAt: closedAt.toISOString(),
        },
      });

      if (closingNotes && closingNotes.trim().length > 0) {
        await tx.insert(caseNotes).values({
          caseId: id,
          authorId: user.id,
          note: `Case closed (${outcome}): ${closingNotes.trim()}`,
        });

        await recordEvent(tx, {
          eventType: "note_added",
          actorId: user.id,
          actorRole: user.role,
          caseId: id,
          metadata: { noteSnippet: closingNotes.trim().slice(0, 50) },
        });
      }

      // Notify creating admin, assigning admin, and Super Admins (in-app + outbox email)
      await notifyCaseClosed({
        tx,
        caseId: id,
        caseNumber: targetCase.caseNumber,
        outcome,
        therapistName: user.name,
        createdById: targetCase.createdBy,
        closedAt,
      });
    });

    return NextResponse.json({ success: true, caseId: id, outcome, closedAt });
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
