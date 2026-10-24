"use client";

import * as React from "react";
import { Icons } from "@/components/ui/icons";

interface KpiCardProps {
  id: string;
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  colorScheme?: "emerald" | "purple" | "blue" | "amber" | "indigo" | "rose" | "slate";
  onClick?: () => void;
  badgeText?: string;
}

export function KpiCard({
  id,
  title,
  value,
  subtitle,
  icon,
  colorScheme = "emerald",
  onClick,
  badgeText,
}: KpiCardProps) {
  return (
    <div
      data-testid={`kpi-card-${id}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`group relative overflow-hidden rounded-none border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.04)] transition-all duration-150 ${
        onClick
          ? "cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#0B7A63]"
          : ""
      }`}
    >
      {/* 2px top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#0B7A63]" />

      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[12px] font-semibold text-slate-500 tracking-wider uppercase">
            {title}
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl sm:text-4xl font-semibold tabular-nums tracking-tight text-slate-900">
              {value}
            </span>
            {badgeText && (
              <span className="rounded-[2px] bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 border border-slate-200">
                {badgeText}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-[12px] text-slate-500 truncate mt-1">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="rounded-none bg-[#0B7A63]/10 text-[#0B7A63] p-2 border border-[#0B7A63]/20">
            {icon}
          </div>
          {onClick && (
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-semibold text-[#0B7A63] flex items-center gap-0.5 mt-1">
              <span>Inspect</span>
              <Icons.ArrowRight className="h-3 w-3" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
