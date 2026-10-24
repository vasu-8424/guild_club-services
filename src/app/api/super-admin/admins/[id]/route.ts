import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/session";
import { editAdminAction, deleteAdminAction } from "@/lib/actions/admin-actions";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiRole("super_admin");
  if (auth.errorResponse) return auth.errorResponse;

  const { id } = await params;

  try {
    const body = await req.json();
    const result = await editAdminAction({ ...body, id });
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiRole("super_admin");
  if (auth.errorResponse) return auth.errorResponse;

  const { id } = await params;

  try {
    let confirmEmail = "";
    try {
      const body = await req.json();
      confirmEmail = body.confirmEmail;
    } catch {
      const { searchParams } = new URL(req.url);
      confirmEmail = searchParams.get("confirmEmail") || "";
    }

    const result = await deleteAdminAction({ userId: id, confirmEmail });
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
