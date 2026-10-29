import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/session";
import { getScope } from "@/lib/scope";
import { db } from "@/db";
import { cases } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiRole("super_admin", "admin", "therapist");
  if (auth.errorResponse) return auth.errorResponse;

  const { id } = await params;
  const user = auth.user;

  const [foundCase] = await db
    .select()
    .from(cases)
    .where(eq(cases.id, id))
    .limit(1);

  if (!foundCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const scope = await getScope(user);
  if (!scope.canAccessBranch(foundCase.branchId)) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  if (
    user.role === "therapist" &&
    foundCase.currentTherapistId !== user.id &&
    foundCase.createdBy !== user.id
  ) {
    return NextResponse.json({ error: "Forbidden: Not assigned to this case" }, { status: 403 });
  }

  return NextResponse.json({ case: foundCase });
}
