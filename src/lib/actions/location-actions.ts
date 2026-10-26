"use server";

import { desc, eq, and } from "drizzle-orm";
import { db } from "@/db";
import { loginRecords, type LoginLocationStatus } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { formatDateTimeIST } from "@/lib/date-utils";
import { getEnv } from "@/lib/env";

export interface RecordLocationInput {
  recordId?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  accuracy?: number | null;
  status: LoginLocationStatus;
}

export interface RecordLocationResult {
  success: boolean;
  status: LoginLocationStatus;
  recordId?: string;
  error?: string;
}

export async function recordLoginLocationAction(
  input: RecordLocationInput
): Promise<RecordLocationResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, status: "unavailable", error: "Unauthorized" };
  }

  try {
    let targetRecordId = input.recordId;

    if (!targetRecordId) {
      // Find the most recent login record for this user
      const [latest] = await db
        .select({ id: loginRecords.id })
        .from(loginRecords)
        .where(eq(loginRecords.userId, user.id))
        .orderBy(desc(loginRecords.loggedInAt))
        .limit(1);

      if (latest) {
        targetRecordId = latest.id;
      }
    }

    if (!targetRecordId) {
      return {
        success: false,
        status: input.status,
        error: "No active login record found to update.",
      };
    }

    const latStr =
      input.latitude !== undefined && input.latitude !== null
        ? String(input.latitude)
        : null;
    const lngStr =
      input.longitude !== undefined && input.longitude !== null
        ? String(input.longitude)
        : null;
    const accuracy =
      input.accuracy !== undefined && input.accuracy !== null
        ? Math.round(Number(input.accuracy))
        : null;

    await db
      .update(loginRecords)
      .set({
        latitude: latStr,
        longitude: lngStr,
        accuracyMeters: accuracy,
        locationStatus: input.status,
      })
      .where(
        and(
          eq(loginRecords.id, targetRecordId),
          eq(loginRecords.userId, user.id)
        )
      );

    return {
      success: true,
      status: input.status,
      recordId: targetRecordId,
    };
  } catch (error) {
    console.error("Failed to update login record location:", error);
    return {
      success: false,
      status: input.status,
      error: "Failed to persist location data.",
    };
  }
}

export interface FormattedLoginRecord {
  id: string;
  loggedInAt: string;
  formattedLoggedInAt: string;
  loggedOutAt: string | null;
  formattedLoggedOutAt: string | null;
  duration: string | null;
  locationStatus: LoginLocationStatus;
  latitude: string | null;
  longitude: string | null;
  accuracyMeters: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  mapUrl: string | null;
}

export async function getTherapistLoginHistoryAction(
  therapistId?: string
): Promise<{ success: boolean; records: FormattedLoginRecord[]; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { success: false, records: [], error: "Unauthorized" };
  }

  // Determine target user
  let targetUserId = therapistId;
  if (currentUser.role === "therapist") {
    // Therapists can only view their own login history
    targetUserId = currentUser.id;
  } else if (!targetUserId) {
    targetUserId = currentUser.id;
  }

  try {
    const rawRecords = await db
      .select()
      .from(loginRecords)
      .where(eq(loginRecords.userId, targetUserId))
      .orderBy(desc(loginRecords.loggedInAt))
      .limit(50);

    const records: FormattedLoginRecord[] = rawRecords.map((r) => {
      let mapUrl: string | null = null;
      if (r.latitude && r.longitude) {
        mapUrl = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(
          r.latitude
        )}&mlon=${encodeURIComponent(r.longitude)}#map=17/${encodeURIComponent(
          r.latitude
        )}/${encodeURIComponent(r.longitude)}`;
      }

      let duration: string | null = "Active session";
      if (r.loggedOutAt) {
        const diffMs = r.loggedOutAt.getTime() - r.loggedInAt.getTime();
        const diffMinutes = Math.max(1, Math.round(diffMs / (1000 * 60)));
        const hours = Math.floor(diffMinutes / 60);
        const mins = diffMinutes % 60;
        duration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
      }

      return {
        id: r.id,
        loggedInAt: r.loggedInAt.toISOString(),
        formattedLoggedInAt: formatDateTimeIST(r.loggedInAt),
        loggedOutAt: r.loggedOutAt ? r.loggedOutAt.toISOString() : null,
        formattedLoggedOutAt: r.loggedOutAt
          ? formatDateTimeIST(r.loggedOutAt)
          : null,
        duration,
        locationStatus: r.locationStatus,
        latitude: r.latitude,
        longitude: r.longitude,
        accuracyMeters: r.accuracyMeters,
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        mapUrl,
      };
    });

    return { success: true, records };
  } catch (error) {
    console.error("Failed to fetch therapist login history:", error);
    return { success: false, records: [], error: "Failed to load login history." };
  }
}

export async function getLocationRequirementAction(): Promise<{
  requireLocationOnLogin: boolean;
}> {
  try {
    const env = getEnv();
    return {
      requireLocationOnLogin: Boolean(env.REQUIRE_LOCATION_ON_LOGIN),
    };
  } catch {
    return { requireLocationOnLogin: false };
  }
}
