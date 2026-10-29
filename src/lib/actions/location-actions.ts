"use server";

import { desc, eq, and } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { loginRecords, type LoginLocationStatus } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { formatDateTimeIST } from "@/lib/date-utils";
import { recordEvent } from "@/lib/events";
import { getEnv } from "@/lib/env";

export interface SaveSignInLocationInput {
  recordId?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  accuracy?: number | null;
  status: "captured" | "denied" | "unavailable";
}

export interface SaveSignInLocationResult {
  success: boolean;
  status: "captured" | "denied" | "unavailable" | "pending";
  recordId?: string;
  error?: string;
}

/**
 * Server Action for saving therapist sign-in location.
 * The board stays locked until sign_in_location_status is 'captured'.
 */
export async function saveSignInLocationAction(
  input: SaveSignInLocationInput
): Promise<SaveSignInLocationResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, status: "unavailable", error: "Unauthorized" };
  }

  try {
    let targetRecordId = input.recordId;

    if (!targetRecordId) {
      if (user.loginRecordId) {
        targetRecordId = user.loginRecordId;
      } else {
        const cookieStore = await cookies();
        const cookieId = cookieStore.get("gcs_latest_login_id")?.value;
        if (cookieId) {
          targetRecordId = cookieId;
        } else {
          const [latest] = await db
            .select({ id: loginRecords.id })
            .from(loginRecords)
            .where(eq(loginRecords.userId, user.id))
            .orderBy(desc(loginRecords.signedInAt))
            .limit(1);
          if (latest) {
            targetRecordId = latest.id;
          }
        }
      }
    }

    if (!targetRecordId) {
      return {
        success: false,
        status: input.status,
        error: "No active login record found to update.",
      };
    }

    const hasCoords =
      input.status === "captured" &&
      input.latitude !== undefined &&
      input.latitude !== null &&
      input.longitude !== undefined &&
      input.longitude !== null;

    const latStr = hasCoords ? String(input.latitude) : null;
    const lngStr = hasCoords ? String(input.longitude) : null;
    const accuracy =
      hasCoords && input.accuracy !== undefined && input.accuracy !== null
        ? Math.round(Number(input.accuracy))
        : null;

    await db
      .update(loginRecords)
      .set({
        signInLatitude: latStr,
        signInLongitude: lngStr,
        signInAccuracyMeters: accuracy,
        signInLocationStatus: input.status,
        // Also update legacy fields for backward compatibility
        latitude: latStr,
        longitude: lngStr,
        accuracyMeters: accuracy,
        locationStatus: input.status === "captured" ? "captured" : input.status === "denied" ? "denied" : "unavailable",
      })
      .where(
        and(
          eq(loginRecords.id, targetRecordId),
          eq(loginRecords.userId, user.id)
        )
      );

    // Audit event: therapist_location_captured
    // NOTE: Exact coordinates are never placed in audit events or logs.
    await recordEvent(db, {
      eventType: "therapist_location_captured",
      actorId: user.id,
      actorRole: user.role,
      targetUserId: user.id,
      metadata: {
        loginRecordId: targetRecordId,
        status: input.status,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      success: true,
      status: input.status,
      recordId: targetRecordId,
    };
  } catch (error) {
    console.error("Failed to update sign-in location:", error);
    return {
      success: false,
      status: input.status,
      error: "Failed to persist location data.",
    };
  }
}

// Backward compatible alias
export const recordLoginLocationAction = saveSignInLocationAction;

export interface FormattedLoginRecord {
  id: string;
  loggedInAt: string;
  formattedLoggedInAt: string;
  loggedOutAt: string | null;
  formattedLoggedOutAt: string | null;
  duration: string | null;
  // Location info (Only visible to Admin and Super Admin; stripped for therapists)
  locationStatus: LoginLocationStatus;
  signInLocationStatus: "captured" | "denied" | "unavailable" | "pending";
  signInLatitude: string | null;
  signInLongitude: string | null;
  signInAccuracyMeters: number | null;
  signInMapUrl: string | null;
  signOutLocationStatus: "captured" | "denied" | "unavailable" | "not_captured" | null;
  signOutLatitude: string | null;
  signOutLongitude: string | null;
  signOutAccuracyMeters: number | null;
  signOutMapUrl: string | null;
  // Legacy aliases
  latitude: string | null;
  longitude: string | null;
  accuracyMeters: number | null;
  mapUrl: string | null;
  ipAddress: string | null;
  userAgent: string | null;
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
      .orderBy(desc(loginRecords.signedInAt))
      .limit(50);

    const isPrivileged = currentUser.role === "admin" || currentUser.role === "super_admin";

    const records: FormattedLoginRecord[] = rawRecords.map((r) => {
      // Build OpenStreetMap links (visible ONLY to Admin / Super Admin)
      let signInMapUrl: string | null = null;
      const sLat = r.signInLatitude || r.latitude;
      const sLng = r.signInLongitude || r.longitude;
      if (isPrivileged && sLat && sLng) {
        signInMapUrl = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(
          sLat
        )}&mlon=${encodeURIComponent(sLng)}#map=17/${encodeURIComponent(
          sLat
        )}/${encodeURIComponent(sLng)}`;
      }

      let signOutMapUrl: string | null = null;
      if (isPrivileged && r.signOutLatitude && r.signOutLongitude) {
        signOutMapUrl = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(
          r.signOutLatitude
        )}&mlon=${encodeURIComponent(r.signOutLongitude)}#map=17/${encodeURIComponent(
          r.signOutLatitude
        )}/${encodeURIComponent(r.signOutLongitude)}`;
      }

      const effectiveSignInDate = r.signedInAt || r.loggedInAt;
      const effectiveSignOutDate = r.signedOutAt || r.loggedOutAt;

      let duration: string | null = "Active session";
      if (effectiveSignOutDate && effectiveSignInDate) {
        const diffMs = effectiveSignOutDate.getTime() - effectiveSignInDate.getTime();
        const diffMinutes = Math.max(1, Math.round(diffMs / (1000 * 60)));
        const hours = Math.floor(diffMinutes / 60);
        const mins = diffMinutes % 60;
        duration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
      }

      return {
        id: r.id,
        loggedInAt: effectiveSignInDate.toISOString(),
        formattedLoggedInAt: formatDateTimeIST(effectiveSignInDate),
        loggedOutAt: effectiveSignOutDate ? effectiveSignOutDate.toISOString() : null,
        formattedLoggedOutAt: effectiveSignOutDate
          ? formatDateTimeIST(effectiveSignOutDate)
          : null,
        duration,
        locationStatus: r.locationStatus,
        signInLocationStatus: r.signInLocationStatus,
        signInLatitude: isPrivileged ? sLat : null,
        signInLongitude: isPrivileged ? sLng : null,
        signInAccuracyMeters: isPrivileged ? (r.signInAccuracyMeters ?? r.accuracyMeters) : null,
        signInMapUrl,
        signOutLocationStatus: r.signOutLocationStatus,
        signOutLatitude: isPrivileged ? r.signOutLatitude : null,
        signOutLongitude: isPrivileged ? r.signOutLongitude : null,
        signOutAccuracyMeters: isPrivileged ? r.signOutAccuracyMeters : null,
        signOutMapUrl,
        latitude: isPrivileged ? sLat : null,
        longitude: isPrivileged ? sLng : null,
        accuracyMeters: isPrivileged ? (r.signInAccuracyMeters ?? r.accuracyMeters) : null,
        mapUrl: signInMapUrl,
        ipAddress: isPrivileged ? r.ipAddress : null,
        userAgent: isPrivileged ? r.userAgent : null,
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
