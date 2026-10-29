"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function DashboardErrorFallback({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[Dashboard Error]", error.name, error.message);
  }, [error]);

  return (
    <div className="p-8">
      <div className="max-w-xl mx-auto border border-amber-300 bg-amber-50 p-6 rounded-none shadow-xs space-y-3 text-left">
        <div className="flex items-center gap-2.5 text-amber-900 font-semibold text-sm">
          <AlertCircle className="h-5 w-5 text-amber-700 shrink-0" />
          <span>Dashboard View Unavailable</span>
        </div>
        <p className="text-xs text-amber-950 leading-relaxed">
          We encountered an issue loading this view. Your session data and clinical progress remain preserved.
        </p>
        <div className="pt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0B7A63] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#096350] cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reload View</span>
          </button>
          <Link
            href="/login"
            className="inline-flex items-center px-3 py-1.5 border border-slate-300 bg-white text-slate-700 text-xs font-semibold uppercase tracking-wider hover:bg-slate-50"
          >
            Return to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

