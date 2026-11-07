import { NextRequest, NextResponse } from "next/server";
import { deleteSessionCookie } from "@/lib/auth";

export async function POST() {
  await deleteSessionCookie();
  return NextResponse.json({ success: true, message: "Logged out successfully" });
}

export async function GET(request: NextRequest) {
  await deleteSessionCookie();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin || "https://guildclub-services.vercel.app";
  return NextResponse.redirect(new URL("/login", baseUrl));
}
