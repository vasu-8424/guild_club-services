"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string = string> {
  label: string;
  value: T;
  badge?: string | number;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
  "data-testid"?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = "md",
  className,
  "data-testid": testId,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      data-testid={testId}
      className={cn(
        "inline-flex border border-slate-300 bg-slate-100/80 p-0.5 rounded-none shadow-[0_1px_0_rgba(15,23,42,0.04)]",
        className
      )}
    >
      {options.map((option, idx) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative inline-flex items-center justify-center font-semibold rounded-none transition-all duration-150 select-none whitespace-nowrap cursor-pointer",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3.5 text-xs sm:text-sm",
              isSelected
                ? "bg-[#0B7A63] text-white shadow-xs font-semibold z-10"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 bg-transparent",
              idx > 0 && !isSelected && options[idx - 1].value !== value
                ? "border-l border-slate-200"
                : ""
            )}
          >
            <span>{option.label}</span>
            {option.badge !== undefined && (
              <span
                className={cn(
                  "ml-1.5 rounded-[2px] px-1.5 py-0.2 text-[10px] font-bold",
                  isSelected
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 text-slate-700"
                )}
              >
                {option.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
