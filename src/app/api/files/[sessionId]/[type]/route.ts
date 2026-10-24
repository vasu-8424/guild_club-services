import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getStorageFile, type SessionFileType } from "@/lib/storage";

interface RouteParams {
  params: Promise<{
    sessionId: string;
    type: string;
  }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  const user = await getCurrentUser();

  // 1. Must be authenticated
  if (!user || !user.isActive || user.deletedAt !== null) {
    return NextResponse.json(
      { error: "Authentication required to access private clinical files." },
      { status: 401 }
    );
  }

  const { sessionId, type } = await params;

  // 2. Fetch session from database
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!session) {
    return NextResponse.json(
      { error: "Session record not found." },
      { status: 404 }
    );
  }

  // 3. Authorization: Super Admin and Admin can access any session;
  // Therapist can only access sessions assigned to them
  if (user.role === "therapist" && session.therapistId !== user.id) {
    return NextResponse.json(
      { error: "Forbidden: You are not authorized to view files for this session." },
      { status: 403 }
    );
  }

  if (user.role !== "therapist" && user.role !== "admin" && user.role !== "super_admin") {
    return NextResponse.json(
      { error: "Forbidden: Insufficient privileges." },
      { status: 403 }
    );
  }

  // 4. Resolve file key according to requested type
  let fileKey: string | null = null;
  if (type === "in-time-photo") {
    fileKey = session.inTimePhotoKey;
  } else if (type === "out-time-photo") {
    fileKey = session.outTimePhotoKey;
  } else if (type === "signature") {
    fileKey = session.patientSignatureKey;
  } else {
    return NextResponse.json(
      { error: "Invalid file type requested." },
      { status: 400 }
    );
  }

  if (!fileKey) {
    return NextResponse.json(
      { error: "File not found for this session." },
      { status: 404 }
    );
  }

  // 5. Retrieve file from storage
  const fileData = await getStorageFile(fileKey);
  if (!fileData) {
    return NextResponse.json(
      { error: "File asset could not be retrieved from storage." },
      { status: 404 }
    );
  }

  // Return binary data with strict private cache headers
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
