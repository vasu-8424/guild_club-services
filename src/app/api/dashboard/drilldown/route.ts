import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { parseDateFilter } from "@/lib/date-utils";
import { getDrilldownActions } from "@/lib/dashboard";

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
    let actorId = searchParams.get("actorId") || undefined;
    const caseId = searchParams.get("caseId") || undefined;
    const eventType = searchParams.get("eventType") || undefined;

    // Security check: If therapist, NEVER trust an actorId passed in query
    if (user.role === "therapist") {
      actorId = user.id;
    }

    const filter = parseDateFilter({ date, from, to });
    const actions = await getDrilldownActions(user, {
      filter,
      actorId,
      caseId,
      eventType,
    });

    return NextResponse.json({ success: true, data: actions });
  } catch (error: any) {
    console.error("Dashboard drilldown API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch drilldown actions" },
      { status: 500 }
    );
  }
}
