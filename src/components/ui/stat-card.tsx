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
  status?: string;
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
  status,
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
        "relative min-h-[120px] rounded-none border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)] transition-all duration-150 flex flex-col justify-between select-none touch-manipulation",
        isClickable &&
          "cursor-pointer hover:border-[#0B7A63] hover:shadow-xs active:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0B7A63]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-semibold text-slate-700 tracking-wide uppercase leading-tight line-clamp-2">
          {label}
        </p>
        {icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none bg-slate-50 text-slate-700 border border-slate-200">
            {icon}
          </div>
        )}
      </div>

      <div className="my-1.5 flex items-baseline gap-2">
        <span className="text-[32px] sm:text-[36px] font-bold tabular-nums tracking-tight text-slate-900 leading-none">
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              "text-[13px] font-semibold",
              trend.isPositive ? "text-emerald-700" : "text-rose-700"
            )}
          >
            {trend.value}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-1 text-[13px] text-slate-500">
        {hint && <p className="truncate leading-tight">{hint}</p>}
        {status && (
          <span className="shrink-0 text-[12px] font-bold uppercase tracking-wider text-[#0B7A63]">
            {status}
          </span>
        )}
      </div>
    </div>
  );
}
