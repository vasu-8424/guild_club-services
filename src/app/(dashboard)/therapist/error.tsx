"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, LayoutDashboard } from "lucide-react";

export default function TherapistError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[Therapist View Error]", error.name, error.message);
  }, [error]);

  return (
    <div className="py-8 px-4 max-w-[480px] mx-auto select-none" data-testid="segment-error-view">
      <div className="border border-amber-300 bg-amber-50 p-6 rounded-none shadow-xs space-y-4 text-left">
        <div className="flex items-center gap-2.5 text-amber-950 font-semibold text-base">
          <AlertCircle className="h-5 w-5 text-amber-700 shrink-0" />
          <span>Could Not Load Daily Board</span>
        </div>
        <p className="text-xs text-amber-900 leading-relaxed">
          We encountered an issue loading your daily sessions. Your clinical notes and recorded sessions are safely preserved.
        </p>
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <button
            type="button"
            data-testid="error-try-again-btn"
            onClick={() => reset()}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#0B7A63] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#096350] active:bg-[#064e3e] rounded-none transition-colors cursor-pointer select-none touch-manipulation"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Try Again</span>
          </button>
          <Link
            href="/therapist/dashboard"
            data-testid="error-dashboard-btn"
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 bg-white text-slate-800 text-xs font-semibold uppercase tracking-wider hover:bg-slate-50 active:bg-slate-100 rounded-none transition-colors select-none touch-manipulation text-center"
          >
            <LayoutDashboard className="h-4 w-4 text-slate-600" />
            <span>Go to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

