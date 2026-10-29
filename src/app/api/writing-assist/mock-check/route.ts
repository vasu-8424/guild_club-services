import { NextResponse } from "next/server";

const globalForMock = globalThis as unknown as {
  lastAssistCall?: {
    maskedText: string;
    mode: string;
    context: string;
  };
  mockProviderDelay?: number;
  mockSimulateTimeout?: boolean;
};

export async function GET() {
  if (process.env.NODE_ENV === "production" && !process.env.PLAYWRIGHT_TEST) {
    return NextResponse.json({ error: "Forbidden in production" }, { status: 403 });
  }

  return NextResponse.json({
    lastCall: globalForMock.lastAssistCall || null,
  });
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production" && !process.env.PLAYWRIGHT_TEST) {
    return NextResponse.json({ error: "Forbidden in production" }, { status: 403 });
  }

  try {
    const body = await req.json();
    if (body.simulateTimeout !== undefined) {
      globalForMock.mockSimulateTimeout = Boolean(body.simulateTimeout);
    }
    if (body.clear) {
      globalForMock.lastAssistCall = undefined;
      globalForMock.mockSimulateTimeout = false;
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}

export async function DELETE() {
  if (process.env.NODE_ENV === "production" && !process.env.PLAYWRIGHT_TEST) {
    return NextResponse.json({ error: "Forbidden in production" }, { status: 403 });
  }

  globalForMock.lastAssistCall = undefined;
  globalForMock.mockSimulateTimeout = false;
  return NextResponse.json({ success: true, cleared: true });
}

