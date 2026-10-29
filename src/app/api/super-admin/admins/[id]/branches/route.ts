import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/session";
import { updateAdminBranchesAction } from "@/lib/actions/admin-actions";
import { db } from "@/db";
import { userBranches, branches } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiRole("super_admin");
  if (auth.errorResponse) return auth.errorResponse;

  const { id } = await params;

  try {
    const adminBranches = await db
      .select({
        id: branches.id,
        name: branches.name,
        isActive: branches.isActive,
      })
      .from(userBranches)
      .innerJoin(branches, eq(branches.id, userBranches.branchId))
      .where(
        and(
          eq(userBranches.userId, id),
          isNull(userBranches.removedAt)
        )
      );

    return NextResponse.json({ branches: adminBranches });
  } catch {
    return NextResponse.json({ error: "Failed to fetch branches" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiRole("super_admin");
  if (auth.errorResponse) return auth.errorResponse;

  const { id } = await params;

  try {
    const body = await req.json();
    const result = await updateAdminBranchesAction({
      adminId: id,
      branchIds: body.branchIds,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}

export async function PUT(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  return PATCH(req, props);
}

