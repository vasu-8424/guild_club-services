import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { parseDateFilter } from "@/lib/date-utils";
import { getPeopleSummary } from "@/lib/dashboard";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "super_admin" && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Therapist cannot access people summary" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get("date") || undefined;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    const filter = parseDateFilter({ date, from, to });
    const people = await getPeopleSummary(user, filter);

    return NextResponse.json({ success: true, data: people });
  } catch (error: any) {
    console.error("Dashboard people API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch people summary" },
      { status: 500 }
    );
  }
}
