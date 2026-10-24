"use client";

import * as React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { ChartContainer, type ChartContainerProps } from "./ChartContainer";
import { Icons } from "@/components/ui/icons";

export interface RadialGaugeProps extends Omit<ChartContainerProps, "children"> {
  percentage: number;
  target?: number; // e.g. target 85%
  successfulCount?: number;
  unsuccessfulCount?: number;
  referredCount?: number;
  totalClosed?: number;
}

export function RadialGauge({
  percentage,
  target = 85,
  successfulCount = 0,
  unsuccessfulCount = 0,
  referredCount = 0,
  totalClosed = 0,
  title = "Overall Success Rate",
  subtitle = "Treatment outcomes & resolution ratio",
  ...containerProps
}: RadialGaugeProps) {
  // Semi-circle gauge data (180 degrees)
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  const remaining = 100 - clamped;

  const data = [
    { name: "Achieved", value: clamped },
    { name: "Remaining", value: remaining },
  ];

  const isEmpty = totalClosed === 0 && percentage === 0;

  return (
    <ChartContainer
      title={title}
      subtitle={subtitle}
      icon={Icons.SuccessRate}
      iconColor="teal"
      isEmpty={isEmpty}
      emptyTitle="No closed cases for this period"
      emptyMessage="Success rate will calculate automatically once cases are discharged or completed."
      ariaLabel={`${title}: ${clamped}% success rate against target ${target}%`}
      {...containerProps}
    >
      <div className="flex flex-col items-center justify-between h-full pt-2">
        {/* Semicircular Gauge */}
        <div className="relative w-full max-w-[240px] h-[140px] flex items-center justify-center">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <Pie
                data={data}
                cx="50%"
                cy="70%"
                startAngle={180}
                endAngle={0}
                innerRadius={70}
                outerRadius={95}
                paddingAngle={0}
                dataKey="value"
                isAnimationActive={true}
                animationDuration={600}
              >
                <Cell fill="#0B7A63" />
                <Cell fill="#E2E8F0" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Centered Number Display */}
          <div className="absolute top-[68px] flex flex-col items-center justify-center text-center">
            <span className="text-3xl sm:text-4xl font-semibold tabular-nums text-slate-900 tracking-tight">
              {clamped}%
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Target: {target}%
            </span>
          </div>
        </div>

        {/* Split Breakdown Beneath Gauge */}
        <div className="w-full grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 mt-4 text-center">
          <div className="p-1.5 border border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-center gap-1.5 mb-0.5">
              <span className="h-2 w-2 rounded-[1px] bg-emerald-600 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Success
              </span>
            </div>
            <div className="text-base font-semibold text-slate-800 tabular-nums">
              {successfulCount}
            </div>
          </div>

          <div className="p-1.5 border border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-center gap-1.5 mb-0.5">
              <span className="h-2 w-2 rounded-[1px] bg-rose-600 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Unsuccessful
              </span>
            </div>
            <div className="text-base font-semibold text-slate-800 tabular-nums">
              {unsuccessfulCount}
            </div>
          </div>

          <div className="p-1.5 border border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-center gap-1.5 mb-0.5">
              <span className="h-2 w-2 rounded-[1px] bg-amber-600 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Referred
              </span>
            </div>
            <div className="text-base font-semibold text-slate-800 tabular-nums">
              {referredCount}
            </div>
          </div>
        </div>
      </div>
    </ChartContainer>
  );
}
