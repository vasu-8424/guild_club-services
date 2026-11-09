import React from "react";

export default function AdminLoading() {
  return (
    <div
      data-testid="segment-loading-skeleton"
      aria-label="Loading admin view"
      className="space-y-4 max-w-[480px] mx-auto animate-pulse py-2"
    >
      {/* Top Banner Skeleton */}
      <div className="h-14 bg-slate-200 rounded-none w-full border border-slate-300/60" />

      {/* Metric Tiles Skeleton */}
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 bg-slate-200 rounded-none border border-slate-300/60" />
        <div className="h-24 bg-slate-200 rounded-none border border-slate-300/60" />
      </div>

      {/* Action / Search Bar Skeleton */}
      <div className="h-12 bg-slate-200 rounded-none w-full border border-slate-300/60" />

      {/* List items skeleton */}
      <div className="space-y-2 pt-2">
        <div className="h-16 bg-slate-200 rounded-none w-full border border-slate-300/60" />
        <div className="h-16 bg-slate-200 rounded-none w-full border border-slate-300/60" />
        <div className="h-16 bg-slate-200 rounded-none w-full border border-slate-300/60" />
      </div>
    </div>
  );
}

