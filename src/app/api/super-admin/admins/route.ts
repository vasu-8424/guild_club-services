import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/session";
import { createAdminAction } from "@/lib/actions/admin-actions";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";

export async function GET(req: Request) {
  const auth = await requireApiRole("super_admin");
  if (auth.errorResponse) return auth.errorResponse;

  const { searchParams } = new URL(req.url);
  const showDeleted = searchParams.get("showDeleted") === "true";

  const condition = showDeleted
    ? eq(users.role, "admin")
    : and(eq(users.role, "admin"), isNull(users.deletedAt));

  const rawAdmins = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      isActive: users.isActive,
      deletedAt: users.deletedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(condition)
    .orderBy(desc(users.createdAt));

  const admins = rawAdmins.map((adm) => ({
    ...adm,
    name: adm.deletedAt ? `${adm.name} (deleted)` : adm.name,
  }));

  return NextResponse.json({ admins });
}

export async function POST(req: Request) {
  const auth = await requireApiRole("super_admin");
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await req.json();
    const result = await createAdminAction(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
