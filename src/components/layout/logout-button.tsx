"use client";

import React, { useState } from "react";
import { logoutAction } from "@/lib/actions/auth-actions";
import { Icons } from "@/components/ui/icons";

interface LogoutButtonProps {
  role?: string;
  className?: string;
  iconOnly?: boolean;
  testId?: string;
  label?: string;
  title?: string;
}

export function LogoutButton({
  role,
  className,
  iconOnly = false,
  testId = "logout-button",
  label = "Log out",
  title = "Sign out of account",
}: LogoutButtonProps) {
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (loggingOut) return;
    setLoggingOut(true);

    // If user is not therapist, logout directly
    if (role !== "therapist") {
      await logoutAction();
      return;
    }

    // Therapist: ask for location before signing out with a max 5 second timeout
    let finished = false;

    const performLogout = async (locationData?: {
      latitude?: number;
      longitude?: number;
      accuracyMeters?: number;
      locationStatus: "captured" | "denied" | "unavailable";
    }) => {
      if (finished) return;
      finished = true;
      try {
        await logoutAction(locationData);
      } catch {
        window.location.href = "/login";
      }
    };

    // Hard fallback timeout (5.2 seconds) to ensure logout is NEVER blocked by location
    const fallbackTimer = setTimeout(() => {
      if (!finished) {
        performLogout({ locationStatus: "unavailable" });
      }
    }, 5200);

    if (typeof window !== "undefined" && navigator?.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(fallbackTimer);
          performLogout({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracyMeters: pos.coords.accuracy,
            locationStatus: "captured",
          });
        },
        (err) => {
          clearTimeout(fallbackTimer);
          const isDenied = err.code === err.PERMISSION_DENIED;
          performLogout({
            locationStatus: isDenied ? "denied" : "unavailable",
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
        }
      );
    } else {
      clearTimeout(fallbackTimer);
      performLogout({ locationStatus: "unavailable" });
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loggingOut}
      data-testid={testId}
      title={title}
      className={
        className ||
        "flex w-full items-center gap-2.5 rounded-none px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
      }
    >
      {loggingOut ? (
        <Icons.Spinner className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Icons.SignOut className={iconOnly ? "h-4 w-4" : "h-3.5 w-3.5"} />
      )}
      {!iconOnly && <span>{loggingOut ? "Signing out..." : label}</span>}
    </button>
  );
}
