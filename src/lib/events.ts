import { caseEvents, type NewCaseEvent } from "@/db/schema";

export interface RecordEventParams {
  eventType: string;
  actorId: string;
  actorRole: string;
  caseId?: string | null;
  targetUserId?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Record an audit event inside an ongoing database transaction.
 *
 * Requirements:
 * Must be called INSIDE the same database transaction as every data change.
 *
 * @param tx - The Drizzle transaction handle (or database client supporting .insert)
 * @param params - Event attributes
 */
export async function recordEvent(
  tx: {
    insert: (table: typeof caseEvents) => {
      values: (values: NewCaseEvent) => Promise<unknown>;
    };
  },
  params: RecordEventParams
) {
  const {
    eventType,
    actorId,
    actorRole,
    caseId = null,
    targetUserId = null,
    fromStatus = null,
    toStatus = null,
    metadata = null,
  } = params;

  return await tx.insert(caseEvents).values({
    eventType,
    actorId,
    actorRole,
    caseId,
    targetUserId,
    fromStatus,
    toStatus,
    metadata: metadata || null,
  });
}
