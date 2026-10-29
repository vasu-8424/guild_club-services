import { NextResponse } from "next/server";
import { mockEmailProvider } from "@/lib/notifications/providers/mock";

export async function GET() {
  if (process.env.NODE_ENV === "production" && !process.env.PLAYWRIGHT_TEST) {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  return NextResponse.json({
    sentEmails: mockEmailProvider.getSentEmails(),
    lastSentEmail: mockEmailProvider.getLastSentEmail() || null,
  });
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production" && !process.env.PLAYWRIGHT_TEST) {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  try {
    const body = await req.json();

    if (body.simulateError) {
      mockEmailProvider.simulateError(
        {
          kind: body.kind || "temporary",
          message: body.message || "Simulated provider failure",
        },
        body.times || 1
      );
      return NextResponse.json({ success: true, simulated: true });
    }

    if (body.clear) {
      mockEmailProvider.clearSentEmails();
      return NextResponse.json({ success: true, cleared: true });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}

export async function DELETE() {
  if (process.env.NODE_ENV === "production" && !process.env.PLAYWRIGHT_TEST) {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  mockEmailProvider.clearSentEmails();
  return NextResponse.json({ success: true, cleared: true });
}

