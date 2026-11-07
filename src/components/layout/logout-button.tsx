"use client";

import React, { useState } from "react";
import { logoutAction } from "@/lib/actions/auth-actions";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface LogoutButtonProps {
  role?: string;
  className?: string;
  iconOnly?: boolean;
  testId?: string;
  label?: string;
  title?: string;
  variant?: "default" | "destructive-outline";
}

/**
 * Clear all native and web caches created by the app, and expire session cookies client-side.
 */
async function clearClientCachesAndCookies() {
  if (typeof window === "undefined") return;

  try {
    // 1. Clear CacheStorage
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // silent
  }

  try {
    // 2. Clear Web Storage
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    // silent
  }

  try {
    // 3. Clear local session cookies
    document.cookie = "gcs_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax;";
    document.cookie = "gcs_selected_branch=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax;";
    document.cookie = "gcs_latest_login_id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax;";
  } catch {
    // silent
  }
}

export function LogoutButton({
  role,
  className,
  iconOnly = false,
  testId = "logout-button",
  label = "Sign Out",
  title = "Sign out of account",
  variant = "default",
}: LogoutButtonProps) {
  const [loggingOut, setLoggingOut] = useState(false);

  const performFinalRedirect = async () => {
    await clearClientCachesAndCookies();
    window.location.href = "/login";
  };

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (loggingOut) return;
    setLoggingOut(true);

    // Pre-clear client caches
    await clearClientCachesAndCookies();

    // If user is not therapist, logout directly
    if (role !== "therapist") {
      try {
        await logoutAction();
      } catch {
        // If network fails, direct redirect anyway
        await performFinalRedirect();
      }
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
        await performFinalRedirect();
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

  const baseStyle =
    variant === "destructive-outline"
      ? "w-full min-h-[52px] h-[52px] border-2 border-rose-600 bg-white text-rose-700 hover:bg-rose-50 active:bg-rose-100 text-base font-bold uppercase tracking-wider rounded-none flex items-center justify-center gap-2 select-none touch-manipulation cursor-pointer transition-colors shadow-xs"
      : "flex w-full items-center gap-2.5 rounded-none px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer";

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loggingOut}
      data-testid={testId}
      title={title}
      className={cn(baseStyle, className)}
    >
      {loggingOut ? (
        <Icons.Spinner className={variant === "destructive-outline" ? "h-5 w-5 animate-spin" : "h-3.5 w-3.5 animate-spin"} />
      ) : (
        <Icons.SignOut className={iconOnly ? "h-4 w-4" : variant === "destructive-outline" ? "h-5 w-5" : "h-3.5 w-3.5"} />
      )}
      {!iconOnly && <span>{loggingOut ? "Signing out..." : label}</span>}
    </button>
  );
}
