import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { assignTherapistRoomAction } from "@/lib/actions/room-actions";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const user = await getCurrentUser();

  if (!user || !user.isActive || user.deletedAt !== null) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  if (user.role !== "admin" && user.role !== "super_admin") {
    return NextResponse.json(
      { error: "Forbidden: Only admins can assign rooms." },
      { status: 403 }
    );
  }

  const { id: therapistId } = await params;
  const body = await request.json().catch(() => ({}));

  const res = await assignTherapistRoomAction({
    therapistId,
    assignedDate: body.assignedDate,
    roomNo: body.roomNo,
  });

  if (!res.success) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: res.data });
}
