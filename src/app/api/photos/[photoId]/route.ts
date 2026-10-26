import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/db";
import { casePhotos, cases } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getStorageFile } from "@/lib/storage";

interface RouteParams {
  params: Promise<{
    photoId: string;
  }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();

  // 1. Must be authenticated
  if (!user || !user.isActive || user.deletedAt !== null) {
    return NextResponse.json(
      { error: "Authentication required to access clinical photos." },
      { status: 401 }
    );
  }

  const { photoId } = await params;

  // 2. Fetch photo record and parent case
  const [record] = await db
    .select({
      id: casePhotos.id,
      caseId: casePhotos.caseId,
      fileKey: casePhotos.fileKey,
      kind: casePhotos.kind,
      currentTherapistId: cases.currentTherapistId,
      createdBy: cases.createdBy,
    })
    .from(casePhotos)
    .innerJoin(cases, eq(cases.id, casePhotos.caseId))
    .where(eq(casePhotos.id, photoId))
    .limit(1);

  if (!record) {
    return NextResponse.json({ error: "Photo record not found." }, { status: 404 });
  }

  // 3. Authorization check:
  // Admin and Super Admin can view all photos.
  // Therapist can ONLY view photos of cases assigned to or created by them.
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

  // 4. Retrieve file from storage
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
