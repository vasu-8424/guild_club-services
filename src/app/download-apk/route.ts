import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const url = new URL("/guild-club-services-v2.apk", request.url);
  return NextResponse.redirect(url, 307);
}
