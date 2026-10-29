"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Structured error logging without user details
    console.error("[Application Error]", error.name, error.message);
  }, [error]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="max-w-md w-full bg-white border border-slate-300 p-8 shadow-xs text-center space-y-4">
        <div className="inline-flex items-center justify-center h-12 w-12 bg-rose-50 border border-rose-200 text-rose-700">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold uppercase tracking-wider text-slate-900">
          System Temporarily Unavailable
        </h1>
        <p className="text-xs text-slate-600 leading-relaxed">
          An unexpected error occurred while processing your clinical request. Your records and drafted notes are safe.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-[#0B7A63] text-white hover:bg-[#096350] transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Try Again</span>
          </button>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold uppercase tracking-wider border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            <span>Portal Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

