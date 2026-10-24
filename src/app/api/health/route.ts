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

  const dbUrl = process.env.DATABASE_URL;
  let maskedHost = "not set";
  if (dbUrl) {
    try {
      const parsed = new URL(dbUrl);
      maskedHost = parsed.host;
    } catch {
      maskedHost = "invalid URL format";
    }
  }

  response.env = {
    has_DATABASE_URL: Boolean(dbUrl),
    database_host: maskedHost,
    has_DATABASE_URL_UNPOOLED: Boolean(process.env.DATABASE_URL_UNPOOLED),
    has_AUTH_SECRET: Boolean(process.env.AUTH_SECRET),
    node_env: process.env.NODE_ENV,
  };

  if (checkDb) {
    try {
      await db.execute(sql`SELECT 1`);
      response.database = "connected";
    } catch (err: any) {
      response.status = "degraded";
      response.database = {
        error: err?.message || "connection failed",
        cause: err?.cause?.message || String(err?.cause || ""),
        code: err?.cause?.code || err?.code,
      };
      return NextResponse.json(response, { status: 503 });
    }
  }

  return NextResponse.json(response, { status: 200 });
}
