"use client";

import * as React from "react";
import Link from "next/link";
import { Icons } from "@/components/ui/icons";

interface TemporaryPasswordBannerProps {
  user: {
    temporaryPasswordPrompt?: boolean;
  };
}

export function TemporaryPasswordBanner({ user }: TemporaryPasswordBannerProps) {
  const [dismissed, setDismissed] = React.useState(false);

  // If user does not require temporary password prompt, or dismissed, do not render
  if (!user.temporaryPasswordPrompt || dismissed) {
    return null;
  }

  return (
    <div
      data-testid="temporary-password-banner"
      className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-900 flex items-center justify-between gap-3 shadow-2xs relative z-20 animate-in fade-in duration-200"
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-none bg-amber-200 text-amber-800">
          <Icons.Security className="h-3.5 w-3.5" />
        </div>
        <p className="font-medium truncate">
          <span>For security, please change your temporary password.</span>{" "}
          <Link
            href="/change-password"
            className="font-bold underline hover:text-amber-950 ml-1 inline-flex items-center gap-1"
          >
            Profile &gt; Change password &rarr;
          </Link>
        </p>
      </div>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 p-1 text-amber-700 hover:text-amber-950 hover:bg-amber-100 rounded-none cursor-pointer transition-colors"
        aria-label="Dismiss banner"
        title="Dismiss warning"
      >
        <Icons.X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
