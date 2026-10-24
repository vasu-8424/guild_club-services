import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  id?: string;
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  onClick?: () => void;
  className?: string;
  "data-testid"?: string;
}

export function StatCard({
  id,
  label,
  value,
  hint,
  icon,
  trend,
  onClick,
  className,
  "data-testid": testId,
}: StatCardProps) {
  const isClickable = Boolean(onClick);

  return (
    <div
      id={id}
      data-testid={testId || (id ? `stat-card-${id}` : undefined)}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        "relative rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all duration-150",
        isClickable &&
          "cursor-pointer hover:border-teal-500/50 hover:shadow-md active:translate-y-px focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-1",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-slate-500 tracking-wide uppercase">
          {label}
        </p>
        {icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-600 border border-slate-200/60">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              "text-xs font-medium",
              trend.isPositive ? "text-emerald-600" : "text-rose-600"
            )}
          >
            {trend.value}
          </span>
        )}
      </div>

      {hint && (
        <p className="mt-1.5 text-xs text-slate-500 truncate">{hint}</p>
      )}
    </div>
  );
}
