"use client";

import * as React from "react";
import { Icons } from "@/components/ui/icons";

export default function OfflinePage() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-50 p-6 antialiased">
      <div className="w-full max-w-sm bg-white border border-slate-200 p-6 text-center space-y-5 shadow-xs rounded-none">
        <div className="w-14 h-14 bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center mx-auto rounded-none">
          <Icons.Alert className="h-7 w-7" />
        </div>

        <div className="space-y-1.5">
          <h1 className="text-[20px] font-semibold tracking-tight text-slate-900">
            You are currently offline
          </h1>
          <p className="text-[14px] text-slate-600 leading-relaxed">
            Please check your internet connection to access clinic records.
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-full min-h-[52px] h-[52px] bg-[#0B7A63] hover:bg-[#086350] active:bg-[#064e3e] text-white font-semibold text-base uppercase tracking-wider rounded-none transition-colors select-none touch-manipulation cursor-pointer shadow-xs"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
