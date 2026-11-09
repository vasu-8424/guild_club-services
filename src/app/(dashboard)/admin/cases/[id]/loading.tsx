import React from "react";

export default function AdminCaseDetailLoading() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-pulse" data-testid="admin-case-page-skeleton">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div className="space-y-2">
          <div className="h-4 w-24 bg-stone-200 rounded-none" />
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="h-8 w-44 bg-stone-200 rounded-none" />
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
              <div className="h-[36px] w-full sm:w-20 bg-stone-200 rounded-none" />
              <div className="h-[36px] w-full sm:w-32 bg-stone-200 rounded-none" />
            </div>
          </div>
          <div className="h-3 w-32 bg-stone-100 rounded-none mt-1" />
        </div>
      </div>
      <div className="bg-white border border-stone-200 p-6 rounded-none shadow-xs h-40" />
      <div className="bg-white border border-stone-200 p-6 rounded-none shadow-xs h-64" />
    </div>
  );
}

