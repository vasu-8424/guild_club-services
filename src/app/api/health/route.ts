import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const checkDb = searchParams.get("db") === "true";

  const response: Record<string, any> = {
    status: "ok",
    app: "Guild Club Services",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };

  let dbHost = "none";
  try {
    if (process.env.DATABASE_URL) {
      dbHost = new URL(process.env.DATABASE_URL).host;
    }
  } catch {
    dbHost = "invalid URL";
  }
  response.dbHost = dbHost;

  if (checkDb) {
    try {
      await db.execute(sql`SELECT 1`);
      response.database = "connected";
    } catch (err: any) {
      response.status = "degraded";
      response.database = "error: " + (err?.cause?.message || err?.message || String(err));
      return NextResponse.json(response, { status: 503 });
    }
  }

  return NextResponse.json(response, { status: 200 });
}
