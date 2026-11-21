import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getScope } from "@/lib/scope";
import { db } from "@/db";
import { inAppNotifications } from "@/db/schema";
import { and, eq, or, isNull, sql } from "drizzle-orm";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || user.deletedAt !== null) {
    return NextResponse.json({ count: 0 }, { status: 401 });
  }

  try {
    let activeBranchId: string | null = null;
    try {
      const scope = await getScope(user);
      activeBranchId = scope.activeBranchId;
    } catch {
      activeBranchId = null;
    }

    const branchCondition =
      user.role === "super_admin" && !activeBranchId
        ? sql`true`
        : activeBranchId
        ? or(
            eq(inAppNotifications.branchId, activeBranchId),
            isNull(inAppNotifications.branchId)
          )
        : isNull(inAppNotifications.branchId);

    const [unreadRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(inAppNotifications)
      .where(
        and(
          eq(inAppNotifications.userId, user.id),
          eq(inAppNotifications.isRead, false),
          branchCondition
        )
      );

    return NextResponse.json({ count: unreadRow?.count ?? 0 });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    return NextResponse.json({ count: 0 }, { status: 500 });
  }
}
