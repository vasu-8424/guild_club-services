import { NextRequest, NextResponse } from "next/server";
import { loginAction } from "@/lib/actions/auth-actions";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await loginAction(body);

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
