import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const response: {
    status: "ok" | "degraded";
    app: string;
    database: "connected" | "disconnected";
    timestamp: string;
    uptime: number;
  } = {
    status: "ok",
    app: "Guild Club Services",
    database: "connected",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  };

  try {
    await db.execute(sql`SELECT 1`);
    response.database = "connected";
  } catch {
    response.status = "degraded";
    response.database = "disconnected";
    return NextResponse.json(response, { status: 503 });
  }

  return NextResponse.json(response, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
