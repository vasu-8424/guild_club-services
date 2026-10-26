"use client";

import React, { useEffect, useState } from "react";
import { recordLoginLocationAction } from "@/lib/actions/location-actions";
import { AlertCircle, CheckCircle2, MapPin, ShieldAlert } from "lucide-react";

interface LocationCaptureProps {
  requireLocation?: boolean;
}

export function LocationCapture({ requireLocation = false }: LocationCaptureProps) {
  const [status, setStatus] = useState<"idle" | "requesting" | "captured" | "denied" | "unavailable">("idle");
  const [bannerVisible, setBannerVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Read the latest login record ID set by loginAction in cookies
    const latestLoginId = typeof document !== "undefined"
      ? document.cookie.match(/(?:^|;\s*)gcs_latest_login_id=([^;]+)/)?.[1] || null
      : null;

    const handledLoginId = typeof window !== "undefined"
      ? sessionStorage.getItem("gcs_location_handled_login_id")
      : null;

    // Only skip if already handled for this specific login record and not strictly required
    if (latestLoginId && handledLoginId === latestLoginId && !requireLocation) {
      return;
    }

    if (!latestLoginId && sessionStorage.getItem("gcs_location_handled") && !requireLocation) {
      return;
    }

    requestLocation(latestLoginId || undefined);
  }, [requireLocation]);

  const requestLocation = (targetRecordId?: string) => {
    setStatus("requesting");
    setErrorMessage(null);

    const latestLoginId = targetRecordId || (typeof document !== "undefined"
      ? document.cookie.match(/(?:^|;\s*)gcs_latest_login_id=([^;]+)/)?.[1] || undefined
      : undefined);

    if (typeof window === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      setBannerVisible(true);
      recordLoginLocationAction({ recordId: latestLoginId, status: "unavailable" });
      sessionStorage.setItem("gcs_location_handled", "unavailable");
      if (latestLoginId) {
        sessionStorage.setItem("gcs_location_handled_login_id", latestLoginId);
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const res = await recordLoginLocationAction({
          recordId: latestLoginId,
          status: "captured",
          latitude,
          longitude,
          accuracy,
        });

        if (res.success) {
          setStatus("captured");
          setBannerVisible(false);
          sessionStorage.setItem("gcs_location_handled", "captured");
          if (latestLoginId) {
            sessionStorage.setItem("gcs_location_handled_login_id", latestLoginId);
          }
        } else {
          setStatus("unavailable");
          setBannerVisible(true);
          sessionStorage.setItem("gcs_location_handled", "unavailable");
          if (latestLoginId) {
            sessionStorage.setItem("gcs_location_handled_login_id", latestLoginId);
          }
        }
      },
      async (err) => {
        const isDenied = err.code === err.PERMISSION_DENIED;
        const locationStatus = isDenied ? "denied" : "unavailable";
        setStatus(locationStatus);
        setBannerVisible(true);
        if (isDenied) {
          setErrorMessage("Location permission was denied.");
        } else {
          setErrorMessage("Location details could not be retrieved.");
        }

        await recordLoginLocationAction({
          recordId: latestLoginId,
          status: locationStatus,
        });
        sessionStorage.setItem("gcs_location_handled", locationStatus);
        if (latestLoginId) {
          sessionStorage.setItem("gcs_location_handled_login_id", latestLoginId);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  };

  // If locked behind screen because location is required by policy and not yet captured
  if (requireLocation && status !== "captured") {
    return (
      <div
        data-testid="location-lock-screen"
        className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/90 backdrop-blur-sm p-4"
      >
        <div className="bg-white border-2 border-stone-900 max-w-md w-full p-6 shadow-2xl rounded-none">
          <div className="flex items-center gap-3 text-emerald-800 mb-4">
            <div className="p-2 bg-emerald-50 border border-emerald-200">
              <MapPin className="w-6 h-6 text-emerald-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold uppercase tracking-tight text-stone-900">
                Location Required
              </h2>
              <p className="text-xs text-stone-500">Guild Club Security Policy</p>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <p className="text-sm text-stone-700 leading-relaxed">
              Guild Club records your location when you sign in. This ensures accountability and verification of clinical shifts.
            </p>
            {status === "denied" && (
              <div
                data-testid="location-denied-alert"
                className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2"
              >
                <ShieldAlert className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <span>
                  Location access was denied. Please allow location permissions in your browser address bar and click retry to unlock your dashboard.
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              data-testid="grant-location-btn"
              onClick={() => requestLocation()}
              disabled={status === "requesting"}
              className="w-full bg-[#0B7A63] hover:bg-[#096350] text-white px-4 py-3 text-sm font-semibold tracking-wide uppercase rounded-none transition-colors disabled:opacity-50"
            >
              {status === "requesting" ? "Requesting Location..." : "Allow Location Access"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Gentle banner when location is not recorded in normal mode
  if (bannerVisible && (status === "denied" || status === "unavailable")) {
    return (
      <div
        data-testid="location-not-recorded-banner"
        className="w-full bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Location not recorded. Your shift time and IP have been logged.</span>
        </div>
        <button
          type="button"
          onClick={() => setBannerVisible(false)}
          className="text-amber-800 hover:text-amber-950 font-bold px-2 py-0.5 text-xs"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return null;
}
