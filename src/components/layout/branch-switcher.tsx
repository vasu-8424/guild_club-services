"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { switchBranchAction } from "@/lib/actions/branch-actions";

interface BranchOption {
  id: string;
  name: string;
  isActive: boolean;
}

interface BranchSwitcherProps {
  allowedBranches: BranchOption[];
  activeBranchId: string | null;
  role: string;
}

export function BranchSwitcher({
  allowedBranches,
  activeBranchId,
  role,
}: BranchSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const isSuperAdmin = role === "super_admin";
  const multipleBranches = allowedBranches.length > 1;

  const handleSelectBranch = (newBranchId: string) => {
    if (!newBranchId) return;
    setError(null);

    startTransition(async () => {
      const result = await switchBranchAction(newBranchId);
      if (!result.success) {
        setError(result.error || "Failed to switch branch");
        return;
      }

      // Update URL with ?branch=<id> while preserving other params or refresh
      const params = new URLSearchParams(searchParams?.toString() || "");
      params.set("branch", newBranchId);
      router.push(`${pathname}?${params.toString()}`);
      router.refresh();
    });
  };

  // If user only has 1 branch (or non-super-admin with 1 branch), render a sleek sharp-corner badge
  if (!isSuperAdmin && !multipleBranches) {
    const singleBranch = allowedBranches[0];
    return (
      <div
        data-testid="branch-switcher"
        className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800 tracking-tight max-w-[120px] sm:max-w-none"
        title={`Assigned Branch: ${singleBranch ? singleBranch.name : "None"}`}
      >
        <svg
          className="h-3.5 w-3.5 text-slate-500 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="square"
            strokeLinejoin="miter"
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
        <span className="truncate">{singleBranch ? singleBranch.name : "No Branch"}</span>
      </div>
    );
  }

  // Super admin or multi-branch admin/therapist: Render interactive dropdown
  return (
    <div
      data-testid="branch-switcher"
      className="inline-flex items-center gap-1.5"
    >
      <label htmlFor="branch-switcher-select" className="sr-only">
        Select Branch
      </label>
      <div className="relative">
        <select
          id="branch-switcher-select"
          data-testid="branch-switcher-select"
          disabled={isPending}
          value={activeBranchId || ""}
          onChange={(e) => handleSelectBranch(e.target.value)}
          className={`h-8 max-w-[110px] sm:max-w-[200px] appearance-none bg-white border border-slate-200 pl-2.5 pr-7 sm:px-3 sm:pr-8 text-xs font-medium tracking-tight text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0B7A63] focus:border-[#0B7A63] rounded-none cursor-pointer transition-colors truncate ${
            !activeBranchId ? "border-amber-400 text-amber-800 bg-amber-50" : ""
          } ${isPending ? "opacity-50 cursor-wait" : ""}`}
        >
          {isSuperAdmin && !activeBranchId && (
            <option value="" disabled>
              Select a Branch...
            </option>
          )}
          {allowedBranches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
          <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </div>
      </div>
      {error && (
        <span className="text-[11px] text-red-600 font-medium">{error}</span>
      )}
    </div>
  );
}
