import { NextResponse } from "next/server";
import { processEmailQueue } from "@/lib/email";

export async function POST() {
  try {
    const result = await processEmailQueue(20);
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Failed to process email queue:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process email queue",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return POST();
}
