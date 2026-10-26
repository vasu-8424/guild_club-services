"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface OutcomeTagProps {
  outcome?: string | null;
  className?: string;
  size?: "sm" | "md";
}

export function OutcomeTag({ outcome, className, size = "sm" }: OutcomeTagProps) {
  const norm = (outcome || "").toLowerCase().trim();

  let colorClasses = "bg-slate-100 text-slate-700 border-slate-200";
  let label = outcome ? outcome.charAt(0).toUpperCase() + outcome.slice(1) : "Unknown";

  if (norm === "successful") {
    colorClasses = "bg-emerald-50 text-emerald-800 border-emerald-300";
    label = "Successful";
  } else if (norm === "unsuccessful") {
    colorClasses = "bg-rose-50 text-rose-800 border-rose-300";
    label = "Unsuccessful";
  } else if (norm === "referred") {
    colorClasses = "bg-amber-50 text-amber-800 border-amber-300";
    label = "Referred";
  }

  const sizeClasses =
    size === "sm"
      ? "px-2 py-0.5 text-[11px] font-semibold tracking-wide"
      : "px-2.5 py-1 text-xs font-semibold tracking-wide";

  return (
    <span
      data-testid={`outcome-tag-${norm || "unknown"}`}
      className={cn(
        "inline-flex items-center rounded-none border uppercase whitespace-nowrap",
        sizeClasses,
        colorClasses,
        className
      )}
    >
      {label}
    </span>
  );
}
