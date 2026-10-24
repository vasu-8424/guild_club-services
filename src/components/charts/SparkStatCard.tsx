"use client";

import * as React from "react";
import { ResponsiveContainer, AreaChart, Area, Tooltip } from "recharts";
import { cn } from "@/lib/utils";
import { Icons, IconTile } from "@/components/ui/icons";
import type { IconProps } from "@phosphor-icons/react";

export interface SparkStatCardProps {
  id?: string;
  label: string;
  value: number | string;
  previousValue?: number | string;
  changePercent?: number; // e.g. +14.2% or -5.1%
  trendDirection?: "up" | "down" | "neutral";
  trendLabel?: string; // "vs previous period"
  sparklineData?: { date?: string; value: number }[];
  color?: "teal" | "indigo" | "sky" | "amber" | "rose" | "slate" | "emerald";
  icon?: React.ComponentType<IconProps>;
  highlightWarning?: boolean; // e.g. amber highlight when unassigned > 0
  onClick?: () => void;
  className?: string;
  "data-testid"?: string;
}

export function SparkStatCard({
  id,
  label,
  value,
  previousValue,
  changePercent,
  trendDirection,
  trendLabel = "vs previous period",
  sparklineData,
  color = "teal",
  icon,
  highlightWarning = false,
  onClick,
  className,
  "data-testid": testId,
}: SparkStatCardProps) {
  // If trendDirection is not explicitly passed, compute from changePercent
  const computedTrend =
    trendDirection ||
    (changePercent != null
      ? changePercent > 0
        ? "up"
        : changePercent < 0
        ? "down"
        : "neutral"
      : undefined);

  // Formatter for numbers
  const displayValue =
    typeof value === "number"
      ? new Intl.NumberFormat("en-IN").format(value)
      : value;

  const colorPalettes = {
    teal: { stroke: "#0B7A63", fill: "#0B7A63" },
    indigo: { stroke: "#4338CA", fill: "#4338CA" },
    sky: { stroke: "#0284C7", fill: "#0284C7" },
    amber: { stroke: "#D97706", fill: "#D97706" },
    rose: { stroke: "#E11D48", fill: "#E11D48" },
    emerald: { stroke: "#059669", fill: "#059669" },
    slate: { stroke: "#64748B", fill: "#64748B" },
  };

  const chartTheme = colorPalettes[color] || colorPalettes.teal;

  // Fallback demo/sparkline points if empty, keeping visualization alive
  const points =
    sparklineData && sparklineData.length > 0
      ? sparklineData
      : [
          { value: 12 },
          { value: 18 },
          { value: 15 },
          { value: 24 },
          { value: 21 },
          { value: 28 },
          { value: Number(typeof value === "number" ? value : 30) },
        ];

  const effectiveTestId = testId || (id ? `kpi-card-${id}` : undefined);

  return (
    <div
      data-testid={effectiveTestId}
      onClick={onClick}
      className={cn(
        "relative rounded-none border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.04)] flex flex-col justify-between transition-all duration-150 text-left select-none overflow-hidden",
        highlightWarning && "border-amber-400 bg-amber-50/20",
        onClick && "cursor-pointer hover:border-slate-300 hover:shadow-xs active:bg-slate-50/50",
        className
      )}
    >
      {/* Top Accent line */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 h-[2px]",
          highlightWarning ? "bg-amber-500" : "bg-[#0B7A63]"
        )}
      />

      {/* Header row: Label + Icon */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </span>
        {icon && (
          <IconTile
            icon={icon}
            color={highlightWarning ? "amber" : color}
            size={18}
            className="h-8 w-8"
          />
        )}
      </div>

      {/* Main Metric Value */}
      <div className="flex items-baseline justify-between gap-3 mt-1">
        <div className="text-3xl sm:text-4xl font-semibold tabular-nums text-slate-900 tracking-tight">
          {displayValue}
        </div>

        {computedTrend && (
          <div
            className={cn(
              "inline-flex items-center gap-1 rounded-[2px] px-2 py-0.5 text-xs font-semibold tabular-nums border",
              computedTrend === "up"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : computedTrend === "down"
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : "bg-slate-50 text-slate-700 border-slate-200"
            )}
          >
            {computedTrend === "up" && <Icons.TrendUp className="h-3.5 w-3.5" />}
            {computedTrend === "down" && <Icons.TrendDown className="h-3.5 w-3.5" />}
            <span>
              {changePercent != null
                ? `${changePercent > 0 ? "+" : ""}${changePercent.toFixed(1)}%`
                : computedTrend.toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Previous period compare line */}
      <div className="mt-1 flex items-center justify-between text-[12px] text-slate-500">
        <span>{trendLabel}</span>
        {previousValue != null && (
          <span className="font-semibold text-slate-700 tabular-nums">
            {typeof previousValue === "number"
              ? new Intl.NumberFormat("en-IN").format(previousValue)
              : previousValue}
          </span>
        )}
      </div>

      {/* Mini Sparkline Chart */}
      <div className="h-10 w-full mt-3 -mb-1 pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`spark-grad-${id || label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartTheme.fill} stopOpacity={0.2} />
                <stop offset="95%" stopColor={chartTheme.fill} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-none border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-800 shadow-xs">
                      {payload[0].value}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={chartTheme.stroke}
              strokeWidth={1.75}
              fillOpacity={1}
              fill={`url(#spark-grad-${id || label})`}
              isAnimationActive={true}
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
