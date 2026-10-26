import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { processNotificationQueue, getEmailQuotaUsage } from "@/lib/notifications";

export async function GET(req: Request) {
  return handleCron(req);
}

export async function POST(req: Request) {
  return handleCron(req);
}

async function handleCron(req: Request) {
  const env = getEnv();
  const authHeader = req.headers.get("authorization");
  const xCronSecret = req.headers.get("x-cron-secret");
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret");

  const providedSecret =
    authHeader?.replace(/^Bearer\s+/i, "") || xCronSecret || querySecret;

  if (env.CRON_SECRET && env.CRON_SECRET.trim() !== "") {
    if (providedSecret !== env.CRON_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing CRON_SECRET" },
        { status: 401 }
      );
    }
  }

  try {
    const quotaBefore = await getEmailQuotaUsage();
    const result = await processNotificationQueue(50);
    const quotaAfter = await getEmailQuotaUsage();

    return NextResponse.json({
      success: true,
      data: {
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
        deferred: result.deferred,
        quota: {
          todaySent: quotaAfter.todaySent,
          dailyLimit: quotaAfter.dailyLimit,
          monthSent: quotaAfter.monthSent,
          monthlyLimit: quotaAfter.monthlyLimit,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[Cron Notifications] Queue processing error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to process notifications cron",
      },
      { status: 500 }
    );
  }
}
