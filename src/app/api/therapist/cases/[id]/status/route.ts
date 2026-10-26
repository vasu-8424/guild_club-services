import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/session";
import { db } from "@/db";
import { cases, type CaseStatus } from "@/db/schema";
import { eq } from "drizzle-orm";
import { recordEvent } from "@/lib/events";
import { updateCaseStatusSchema } from "@/lib/validators";

const allowedTransitions: Record<CaseStatus, CaseStatus[]> = {
  new: ["assigned"],
  assigned: ["accepted", "new"],
  accepted: ["in_progress"],
  in_progress: ["on_hold", "completed"],
  on_hold: ["in_progress", "completed", "active"],
  completed: [],
  active: ["completed", "on_hold"],
};

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
    const parsed = updateCaseStatusSchema.safeParse({ caseId: id, ...body });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid status transition" },
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

    if (targetCase.status === "completed") {
      return NextResponse.json({ error: "Cannot edit a completed case" }, { status: 400 });
    }

    const currentStatus = targetCase.status;
    const newStatus = parsed.data.status;

    if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
      return NextResponse.json(
        { error: `Invalid transition from '${currentStatus}' to '${newStatus}'` },
        { status: 400 }
      );
    }

    await db.transaction(async (tx) => {
      await tx
        .update(cases)
        .set({ status: newStatus })
        .where(eq(cases.id, id));

      await recordEvent(tx, {
        eventType: "status_changed",
        actorId: user.id,
        actorRole: user.role,
        caseId: id,
        fromStatus: currentStatus,
        toStatus: newStatus,
        metadata: { notes: parsed.data.notes ?? null },
      });
    });

    return NextResponse.json({ success: true, caseId: id, status: newStatus });
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
