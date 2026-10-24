import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/session";
import { resetAdminPasswordAction } from "@/lib/actions/admin-actions";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiRole("super_admin");
  if (auth.errorResponse) return auth.errorResponse;

  const { id } = await params;

  try {
    const body = await req.json();
    const result = await resetAdminPasswordAction({
      userId: id,
      password: body.password,
      confirmPassword: body.confirmPassword,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
