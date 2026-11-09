import React from "react";
import Link from "next/link";
import { FileQuestion, LayoutDashboard } from "lucide-react";

export default function DashboardNotFound() {
  return (
    <div className="py-12 px-4 max-w-[480px] mx-auto select-none" data-testid="segment-not-found-view">
      <div className="border border-slate-200 bg-white p-6 rounded-none shadow-xs space-y-4 text-center">
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-none bg-slate-100 flex items-center justify-center text-slate-500">
            <FileQuestion className="h-6 w-6" />
          </div>
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Page Not Found</h2>
          <p className="text-xs text-slate-600 mt-1">
            The requested page does not exist or has been moved.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/"
            data-testid="error-dashboard-btn"
            className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#0B7A63] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#096350] rounded-none transition-colors select-none touch-manipulation"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Go to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

