"use client";

import * as React from "react";

interface StaleUiGuardProps {
  currentBuildId?: string;
}

export function StaleUiGuard({ currentBuildId }: StaleUiGuardProps) {
  const pageBuildId =
    currentBuildId ||
    process.env.NEXT_PUBLIC_BUILD_ID ||
    "gcs-live";

  const [hasNewVersion, setHasNewVersion] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);

  const checkVersion = React.useCallback(async () => {
    try {
      const res = await fetch("/api/health", {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.buildId && pageBuildId && data.buildId !== pageBuildId) {
          setHasNewVersion(true);
        }
      }
    } catch {
      // Non-blocking version check
    }
  }, [pageBuildId]);

  React.useEffect(() => {
    // Check on initial mount
    checkVersion();

    // Check when user returns to app foreground
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkVersion();
      }
    };

    const handleFocus = () => {
      checkVersion();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [checkVersion]);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.update()));
      }
    } catch {
      // Reload regardless
    }
    window.location.reload();
  };

  if (!hasNewVersion) return null;

  return (
    <div
      data-testid="stale-ui-update-banner"
      role="alert"
      className="sticky top-0 z-50 w-full bg-[#0B7A63] text-white px-4 py-2.5 shadow-md flex items-center justify-between gap-3 text-xs font-semibold rounded-none animate-in fade-in slide-in-from-top-1"
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse shrink-0" />
        <span className="truncate">A new version is available.</span>
      </div>
      <button
        type="button"
        data-testid="stale-ui-update-btn"
        onClick={handleUpdate}
        disabled={isUpdating}
        className="shrink-0 px-3 py-1 bg-white text-[#0B7A63] font-bold text-[11px] uppercase tracking-wider hover:bg-emerald-50 active:bg-emerald-100 transition-colors cursor-pointer rounded-none disabled:opacity-50"
      >
        {isUpdating ? "Updating..." : "Tap to update"}
      </button>
    </div>
  );
}

