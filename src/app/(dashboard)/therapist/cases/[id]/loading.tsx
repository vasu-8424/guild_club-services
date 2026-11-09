import React from "react";

export default function CaseDetailLoading() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-pulse" data-testid="case-page-skeleton">
      {/* Top Navigation & Action Bar Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div className="space-y-2">
          <div className="h-4 w-24 bg-stone-200 rounded-none" />
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="h-8 w-44 bg-stone-200 rounded-none" data-testid="case-header-skeleton" />
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
              <div className="h-[36px] w-full sm:w-20 bg-stone-200 rounded-none" />
              <div className="h-[36px] w-full sm:w-32 bg-stone-200 rounded-none" />
            </div>
          </div>
          <div className="h-3 w-32 bg-stone-100 rounded-none mt-1" />
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          <div className="h-[48px] w-full sm:w-36 bg-stone-200 rounded-none" />
          <div className="h-[48px] w-full sm:w-32 bg-stone-200 rounded-none" />
        </div>
      </div>

      {/* Patient & Intake Details Card Skeleton */}
      <div className="bg-white border border-stone-200 p-6 rounded-none shadow-xs space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="h-2.5 w-16 bg-stone-200 rounded-none" />
            <div className="h-4 w-28 bg-stone-300 rounded-none" />
          </div>
          <div className="space-y-1">
            <div className="h-2.5 w-16 bg-stone-200 rounded-none" />
            <div className="h-4 w-24 bg-stone-300 rounded-none" />
          </div>
          <div className="space-y-1">
            <div className="h-2.5 w-16 bg-stone-200 rounded-none" />
            <div className="h-4 w-24 bg-stone-300 rounded-none" />
          </div>
          <div className="space-y-1">
            <div className="h-2.5 w-16 bg-stone-200 rounded-none" />
            <div className="h-4 w-32 bg-stone-300 rounded-none" />
          </div>
        </div>

        <div className="pt-4 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="h-2.5 w-20 bg-stone-200 rounded-none" />
            <div className="h-4 w-full bg-stone-100 rounded-none" />
          </div>
          <div className="space-y-1">
            <div className="h-2.5 w-32 bg-stone-200 rounded-none" />
            <div className="h-4 w-full bg-stone-100 rounded-none" />
          </div>
        </div>
      </div>

      {/* Tab bar skeleton */}
      <div className="flex border-b border-stone-200 bg-white">
        <div className="h-10 w-40 bg-stone-200 rounded-none mr-2" />
        <div className="h-10 w-36 bg-stone-100 rounded-none" />
      </div>

      {/* Tab content skeleton */}
      <div className="bg-white border border-stone-200 p-6 h-64 rounded-none" />
    </div>
  );
}

