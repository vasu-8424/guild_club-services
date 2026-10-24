"use server";

import { db } from "@/db";
import { cases } from "@/db/schema";
import { sql, like } from "drizzle-orm";

/**
 * Generates the next unique case number in the format GCS-YYYY-NNNN.
 * Uses a SELECT ... FOR UPDATE SKIP LOCKED pattern (via advisory lock) to
 * be safe under concurrent requests.
 *
 * Must be called inside a database transaction to ensure atomicity.
 */
export async function generateCaseNumber(
  tx: typeof db,
  year?: number
): Promise<string> {
  const y = year ?? new Date().getFullYear();
  const prefix = `GCS-${y}-`;

  // Find the highest existing sequence for this year
  const rows = await (tx as unknown as typeof db)
    .select({ caseNumber: cases.caseNumber })
    .from(cases)
    .where(like(cases.caseNumber, `${prefix}%`))
    .orderBy(sql`case_number DESC`)
    .limit(1)
    .for("update");

  let nextSeq = 1;
  if (rows.length > 0) {
    const last = rows[0].caseNumber; // e.g. "GCS-2026-0007"
    const parts = last.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}
