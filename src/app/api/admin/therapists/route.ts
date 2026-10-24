import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/session";
import { createTherapistAction } from "@/lib/actions/therapist-actions";
import { db } from "@/db";
import { users, therapistProfiles } from "@/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";

export async function GET(req: Request) {
  const auth = await requireApiRole("super_admin", "admin");
  if (auth.errorResponse) return auth.errorResponse;

  const { searchParams } = new URL(req.url);
  const showDeleted = searchParams.get("showDeleted") === "true";

  const condition = showDeleted
    ? eq(users.role, "therapist")
    : and(eq(users.role, "therapist"), isNull(users.deletedAt));

  const rawTherapists = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      isActive: users.isActive,
      deletedAt: users.deletedAt,
      specialization: therapistProfiles.specialization,
      maxOpenCases: therapistProfiles.maxOpenCases,
      experienceYears: therapistProfiles.experienceYears,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(therapistProfiles, eq(users.id, therapistProfiles.userId))
    .where(condition)
    .orderBy(desc(users.createdAt));

  const therapists = rawTherapists.map((th) => ({
    ...th,
    name: th.deletedAt ? `${th.name} (deleted)` : th.name,
  }));

  return NextResponse.json({ therapists });
}

export async function POST(req: Request) {
  const auth = await requireApiRole("super_admin", "admin");
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await req.json();
    const result = await createTherapistAction(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
