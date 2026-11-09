import React from "react";

export default function SuperAdminLoading() {
  return (
    <div
      data-testid="segment-loading-skeleton"
      aria-label="Loading super admin view"
      className="space-y-4 max-w-[480px] mx-auto animate-pulse py-2"
    >
      {/* Date selector skeleton */}
      <div className="h-12 bg-slate-200 rounded-none w-full border border-slate-300/60" />

      {/* Primary section skeleton */}
      <div className="h-40 bg-slate-200 rounded-none w-full border border-slate-300/60" />

      {/* List items skeleton */}
      <div className="space-y-2 pt-2">
        <div className="h-16 bg-slate-200 rounded-none w-full border border-slate-300/60" />
        <div className="h-16 bg-slate-200 rounded-none w-full border border-slate-300/60" />
      </div>
    </div>
  );
}

