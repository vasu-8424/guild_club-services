import React from "react";

export default function TherapistLoading() {
  return (
    <div
      data-testid="segment-loading-skeleton"
      aria-label="Loading therapist daily board"
      className="space-y-4 max-w-[480px] mx-auto animate-pulse py-2"
    >
      {/* Date banner skeleton */}
      <div className="h-14 bg-slate-200 rounded-none w-full border border-slate-300/60" />

      {/* Progress bar skeleton */}
      <div className="h-3 bg-slate-200 rounded-none w-full border border-slate-300/60" />

      {/* Daily board patient tiles skeleton */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="h-28 bg-slate-200 rounded-none border border-slate-300/60" />
        <div className="h-28 bg-slate-200 rounded-none border border-slate-300/60" />
        <div className="h-28 bg-slate-200 rounded-none border border-slate-300/60" />
        <div className="h-28 bg-slate-200 rounded-none border border-slate-300/60" />
      </div>
    </div>
  );
}

