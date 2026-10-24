import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/session";
import { createCaseAction } from "@/lib/actions/case-actions";
import { db } from "@/db";
import { cases } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const auth = await requireApiRole("super_admin", "admin");
  if (auth.errorResponse) return auth.errorResponse;

  const allCases = await db.select().from(cases).orderBy(desc(cases.createdAt));
  return NextResponse.json({ cases: allCases });
}

export async function POST(req: Request) {
  const auth = await requireApiRole("super_admin", "admin");
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await req.json();
    const result = await createCaseAction(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      caseId: result.data?.id,
      caseNumber: result.data?.caseNumber,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
