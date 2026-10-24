import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/session";
import { db } from "@/db";
import { cases, caseNotes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { recordEvent } from "@/lib/events";
import { addNoteSchema } from "@/lib/validators";

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
    const parsed = addNoteSchema.safeParse({ caseId: id, ...body });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid note input" },
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
      return NextResponse.json({ error: "Cannot add notes to a completed case" }, { status: 400 });
    }

    let noteId: string = "";
    await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(caseNotes)
        .values({
          caseId: id,
          authorId: user.id,
          note: parsed.data.note,
        })
        .returning({ id: caseNotes.id });

      noteId = inserted.id;

      await recordEvent(tx, {
        eventType: "note_added",
        actorId: user.id,
        actorRole: user.role,
        caseId: id,
        metadata: {
          noteId,
          noteSnippet: parsed.data.note.slice(0, 50),
        },
      });
    });

    return NextResponse.json({ success: true, noteId });
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
