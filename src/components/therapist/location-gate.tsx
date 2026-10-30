"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSignInLocationAction } from "@/lib/actions/location-actions";
import { MapPin, AlertCircle, RefreshCw, Compass, ShieldAlert, CheckCircle2 } from "lucide-react";

interface LocationGateProps {
  recordId?: string;
  initialStatus?: "pending" | "denied" | "unavailable" | "captured";
}

export function LocationGate({ recordId, initialStatus = "pending" }: LocationGateProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"pending" | "requesting" | "denied" | "unavailable" | "captured">(
    initialStatus === "captured" ? "captured" : "pending"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Attempt automatic prompt on initial mount
    requestCurrentPosition();
  }, []);

  const requestCurrentPosition = () => {
    setStatus("requesting");
    setErrorMessage(null);

    if (typeof window === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      setErrorMessage("Geolocation is not supported by your browser or environment.");
      saveSignInLocationAction({ recordId, status: "unavailable" }).catch(() => {});
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude, accuracy } = pos.coords;
          const res = await saveSignInLocationAction({
            recordId,
            status: "captured",
            latitude,
            longitude,
            accuracy,
          });

          if (res.success && res.status === "captured") {
            setStatus("captured");
            // Reload page to allow server-side check to pass
            window.location.reload();
          } else {
            setStatus("unavailable");
            setErrorMessage(res.error || "Failed to record your position on the server.");
          }
        } catch (e: any) {
          setStatus("unavailable");
          setErrorMessage(e?.message || "An unexpected error occurred while saving location.");
        }
      },
      async (err) => {
        if (process.env.NODE_ENV !== "production") {
          console.error(`[Geolocation Error] Code ${err.code}: ${err.message}`);
        }

        const isDenied = err.code === err.PERMISSION_DENIED;
        const targetStatus = isDenied ? "denied" : "unavailable";
        setStatus(targetStatus);

        if (isDenied) {
          setErrorMessage(
            "Location permission was denied. Location is required to access your branch's daily sessions board."
          );
        } else if (err.code === err.TIMEOUT) {
          setErrorMessage("Location request timed out. Please verify your connection or GPS.");
        } else {
          setErrorMessage("Location information is currently unavailable from your device.");
        }

        await saveSignInLocationAction({
          recordId,
          status: targetStatus,
        }).catch(() => {});
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  return (
    <div
      data-testid="location-gate"
      className="min-h-[80vh] flex items-center justify-center p-4 bg-stone-100"
    >
      <div className="w-full max-w-xl bg-white border-2 border-stone-900 rounded-none shadow-2xl p-4 sm:p-6 lg:p-8">
        {/* Header Icon */}
        <div className="flex items-center gap-3 border-b border-stone-200 pb-4 mb-6">
          <div className="p-3 bg-emerald-100 text-[#0B7A63] border border-emerald-300">
            <Compass className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold uppercase tracking-tight text-stone-900">
              Location Verification Required
            </h2>
            <p className="text-xs text-stone-500">
              Mandatory branch attendance and sign-in record
            </p>
          </div>
        </div>

        {/* Primary Notice */}
        <div className="p-4 bg-emerald-50/70 border-l-4 border-[#0B7A63] text-stone-800 text-sm mb-6">
          <p className="font-semibold text-stone-900 mb-1">
            Guild Club records your sign-in time and location for your branch&apos;s records.
          </p>
          <p className="text-xs text-stone-600">
            Allow location to continue to your Daily Sessions Board. The board remains locked until your browser confirms your location.
          </p>
        </div>

        {/* Requesting State */}
        {status === "requesting" && (
          <div className="flex items-center justify-center gap-3 py-8 text-sm font-medium text-stone-700 bg-stone-50 border border-dashed border-stone-300 mb-6">
            <RefreshCw className="w-5 h-5 animate-spin text-[#0B7A63]" />
            <span>Requesting location permission from your browser...</span>
          </div>
        )}

        {/* Captured Success State */}
        {status === "captured" && (
          <div className="flex items-center justify-center gap-3 py-8 text-sm font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 mb-6">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Location captured successfully! Loading your board...</span>
          </div>
        )}

        {/* Denied or Unavailable State */}
        {(status === "denied" || status === "unavailable") && (
          <div className="space-y-4 mb-6">
            <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-900 uppercase tracking-wide">
                  {status === "denied" ? "Permission Denied" : "Location Unavailable"}
                </p>
                <p className="mt-1">{errorMessage}</p>
              </div>
            </div>

            {/* Step-by-Step Instructions */}
            <div className="border border-stone-200 bg-stone-50 p-4 text-xs text-stone-700">
              <h4 className="font-bold text-stone-900 uppercase tracking-tight mb-2">
                How to enable location in your browser:
              </h4>
              <ol className="list-decimal list-inside space-y-1.5 pl-1 leading-relaxed">
                <li>
                  Click the <strong>padlock or site settings icon</strong> on the left side of the address bar.
                </li>
                <li>
                  Locate <strong>Location</strong> permission and change it from <em>Block</em> to <strong>Allow</strong>.
                </li>
                <li>
                  If prompted, ensure your device&apos;s system location service is turned on.
                </li>
                <li>
                  Click the <strong>Try again</strong> button below or refresh this page.
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-stone-200">
          <p className="text-[11px] text-stone-500">
            Exact GPS works on phones/mobile devices. Laptops use Wi-Fi location.
          </p>

          <button
            type="button"
            data-testid="try-again-location-btn"
            disabled={status === "requesting" || status === "captured"}
            onClick={requestCurrentPosition}
            className="w-full sm:w-auto px-5 py-2.5 bg-[#0B7A63] hover:bg-[#086350] disabled:bg-stone-400 text-white font-bold text-xs uppercase tracking-wider rounded-none transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${status === "requesting" ? "animate-spin" : ""}`} />
            <span>{status === "requesting" ? "Checking..." : "Try again"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
