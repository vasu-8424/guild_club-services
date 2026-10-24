import { NextRequest, NextResponse } from "next/server";
import { changePasswordAction } from "@/lib/actions/auth-actions";
import { getCurrentUser } from "@/lib/session";

export async function POST(req: NextRequest) {
  // Access control check: user must be authenticated
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { error: "Unauthorized. Please log in." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const result = await changePasswordAction(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, fieldErrors: result.fieldErrors },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      redirectTo: result.redirectTo,
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 }
    );
  }
}
