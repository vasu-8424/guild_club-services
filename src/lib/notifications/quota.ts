import { db } from "@/db";
import { emailQueue } from "@/db/schema";
import { eq, gte, and, sql } from "drizzle-orm";
import { getEnv } from "@/lib/env";

/**
 * Returns the UTC Date representing midnight (00:00:00) of today in Asia/Kolkata (IST).
 */
export function getIstTodayRange(): { start: Date; end: Date; tomorrowStart: Date } {
  const now = new Date();
  // IST offset is +5.5 hours (+330 minutes)
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);

  const istYear = istNow.getUTCFullYear();
  const istMonth = istNow.getUTCMonth();
  const istDate = istNow.getUTCDate();

  // UTC timestamp corresponding to IST 00:00:00
  const startUtcMs = Date.UTC(istYear, istMonth, istDate, 0, 0, 0, 0) - istOffsetMs;
  const endUtcMs = Date.UTC(istYear, istMonth, istDate, 23, 59, 59, 999) - istOffsetMs;
  const tomorrowStartUtcMs = Date.UTC(istYear, istMonth, istDate + 1, 0, 0, 0, 0) - istOffsetMs;

  return {
    start: new Date(startUtcMs),
    end: new Date(endUtcMs),
    tomorrowStart: new Date(tomorrowStartUtcMs),
  };
}

/**
 * Returns the UTC Date representing the 1st day (00:00:00) of the current month in Asia/Kolkata (IST).
 */
export function getIstMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);

  const istYear = istNow.getUTCFullYear();
  const istMonth = istNow.getUTCMonth();

  const startUtcMs = Date.UTC(istYear, istMonth, 1, 0, 0, 0, 0) - istOffsetMs;
  // Last day of current month in IST
  const nextMonthStartUtcMs = Date.UTC(istYear, istMonth + 1, 1, 0, 0, 0, 0) - istOffsetMs;
  const endUtcMs = nextMonthStartUtcMs - 1;

  return {
    start: new Date(startUtcMs),
    end: new Date(endUtcMs),
  };
}

export interface QuotaUsage {
  todaySent: number;
  dailyLimit: number;
  todayRemaining: number;
  dailyPercent: number;
  monthSent: number;
  monthlyLimit: number;
  monthRemaining: number;
  monthlyPercent: number;
  isDailyExceeded: boolean;
  isMonthlyExceeded: boolean;
  isWarning: boolean; // >= 80% usage
}

/**
 * Calculates current daily and monthly email usage against Resend limits.
 */
export async function getEmailQuotaUsage(): Promise<QuotaUsage> {
  const env = getEnv();
  const dailyLimit = env.EMAIL_DAILY_LIMIT;
  const monthlyLimit = env.EMAIL_MONTHLY_LIMIT;

  const { start: todayStart } = getIstTodayRange();
  const { start: monthStart } = getIstMonthRange();

  // Query successfully sent emails count today
  const [todayResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(emailQueue)
    .where(
      and(
        eq(emailQueue.status, "sent"),
        gte(emailQueue.sentAt, todayStart)
      )
    );

  // Query successfully sent emails count this month
  const [monthResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(emailQueue)
    .where(
      and(
        eq(emailQueue.status, "sent"),
        gte(emailQueue.sentAt, monthStart)
      )
    );

  const todaySent = todayResult?.count ?? 0;
  const monthSent = monthResult?.count ?? 0;

  const todayRemaining = Math.max(0, dailyLimit - todaySent);
  const monthRemaining = Math.max(0, monthlyLimit - monthSent);

  const dailyPercent = Math.min(100, Math.round((todaySent / dailyLimit) * 100));
  const monthlyPercent = Math.min(100, Math.round((monthSent / monthlyLimit) * 100));

  const isDailyExceeded = todaySent >= dailyLimit;
  const isMonthlyExceeded = monthSent >= monthlyLimit;
  const isWarning = dailyPercent >= 80 || monthlyPercent >= 80;

  return {
    todaySent,
    dailyLimit,
    todayRemaining,
    dailyPercent,
    monthSent,
    monthlyLimit,
    monthRemaining,
    monthlyPercent,
    isDailyExceeded,
    isMonthlyExceeded,
    isWarning,
  };
}
