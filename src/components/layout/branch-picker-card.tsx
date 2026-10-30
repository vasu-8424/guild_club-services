"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { switchBranchAction } from "@/lib/actions/branch-actions";
import type { ScopeBranch } from "@/lib/scope";

interface BranchPickerCardProps {
  branches: ScopeBranch[];
  title?: string;
  description?: string;
}

export function BranchPickerCard({
  branches,
  title = "Select a Branch to Continue",
  description = "Super Administrator views data by picking a branch first. Data, room allocations, active cases, and clinical metrics are strictly isolated per branch.",
}: BranchPickerCardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleSelect = async (branchId: string) => {
    setLoadingId(branchId);
    setError(null);
    try {
      const res = await switchBranchAction(branchId);
      if (!res.success) {
        setError(res.error || "Failed to select branch");
        setLoadingId(null);
        return;
      }
      const params = new URLSearchParams(searchParams?.toString() || "");
      params.set("branch", branchId);
      router.push(`${pathname}?${params.toString()}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      setLoadingId(null);
    }
  };

  return (
    <div
      data-testid="branch-picker-card"
      className="bg-white border border-slate-200 p-4 sm:p-6 lg:p-8 shadow-sm rounded-none my-6"
    >
      <div className="max-w-2xl">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-xs font-semibold text-[#0B7A63] tracking-wide uppercase mb-3">
          Branch-Based Data Isolation
        </div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-600 leading-relaxed">
          {description}
        </p>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      {branches.length === 0 ? (
        <div className="mt-6 p-6 bg-slate-50 border border-slate-200 text-center text-sm text-slate-500">
          No active branches available. Please configure branches in the management portal.
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {branches.map((branch) => {
            const isLoading = loadingId === branch.id;
            return (
              <div
                key={branch.id}
                className="group relative border border-slate-200 bg-slate-50 p-5 hover:border-[#0B7A63] hover:bg-white transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                      Branch
                    </span>
                    <span className="inline-flex h-2 w-2 bg-emerald-500" />
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-slate-900 group-hover:text-[#0B7A63] transition-colors">
                    {branch.name}
                  </h3>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200 flex justify-end">
                  <button
                    type="button"
                    data-testid={`select-branch-btn-${branch.id}`}
                    disabled={isLoading}
                    onClick={() => handleSelect(branch.id)}
                    className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-[#0B7A63] hover:bg-[#096350] disabled:opacity-50 transition-colors rounded-none cursor-pointer"
                  >
                    {isLoading ? "Selecting..." : "Open Branch"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
