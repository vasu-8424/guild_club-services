import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/db";
import { casePhotos, cases } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getStorageFile } from "@/lib/storage";
import { getScope } from "@/lib/scope";

interface RouteParams {
  params: Promise<{
    caseId: string;
    photoId: string;
  }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();

  if (!user || !user.isActive || user.deletedAt !== null) {
    return NextResponse.json(
      { error: "Authentication required to access clinical photos." },
      { status: 401 }
    );
  }

  const { caseId, photoId } = await params;

  const [record] = await db
    .select({
      id: casePhotos.id,
      caseId: casePhotos.caseId,
      fileKey: casePhotos.fileKey,
      kind: casePhotos.kind,
      currentTherapistId: cases.currentTherapistId,
      createdBy: cases.createdBy,
      branchId: cases.branchId,
    })
    .from(casePhotos)
    .innerJoin(cases, eq(cases.id, casePhotos.caseId))
    .where(and(eq(casePhotos.id, photoId), eq(casePhotos.caseId, caseId)))
    .limit(1);

  if (!record) {
    return NextResponse.json({ error: "Photo record not found." }, { status: 404 });
  }

  const scope = await getScope(user);
  if (!scope.canAccessBranch(record.branchId)) {
    return NextResponse.json({ error: "Photo record not found." }, { status: 404 });
  }

  if (user.role === "therapist") {
    const isOwner =
      record.currentTherapistId === user.id || record.createdBy === user.id;
    if (!isOwner) {
      return NextResponse.json(
        { error: "Forbidden: You cannot access photos for another therapist's patient." },
        { status: 403 }
      );
    }
  } else if (user.role !== "admin" && user.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const fileData = await getStorageFile(record.fileKey);
  if (!fileData) {
    return NextResponse.json({ error: "Photo file not found in storage." }, { status: 404 });
  }

  return new Response(new Uint8Array(fileData.buffer), {
    status: 200,
    headers: {
      "Content-Type": fileData.contentType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
