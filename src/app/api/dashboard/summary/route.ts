import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { parseDateFilter } from "@/lib/date-utils";
import { getDashboardSummary } from "@/lib/dashboard";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get("date") || undefined;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    const filter = parseDateFilter({ date, from, to });
    const summary = await getDashboardSummary(user, filter);

    return NextResponse.json({ success: true, data: summary });
  } catch (error: any) {
    if (error?.message?.includes("Unauthorized") || error?.digest === "NEXT_REDIRECT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message?.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Dashboard summary API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard summary" },
      { status: 500 }
    );
  }
}
