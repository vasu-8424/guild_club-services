import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const url = new URL("/login", request.url);
  return NextResponse.redirect(url, 307);
}
