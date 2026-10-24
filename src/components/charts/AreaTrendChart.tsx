"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { ChartContainer, type ChartContainerProps } from "./ChartContainer";
import { Icons } from "@/components/ui/icons";

export interface TrendDataPoint {
  date: string;
  current: number;
  previous?: number;
  completed?: number;
  [key: string]: any;
}

export interface AreaTrendChartProps extends Omit<ChartContainerProps, "children"> {
  data: TrendDataPoint[];
  currentKey?: string;
  currentLabel?: string;
  previousKey?: string;
  previousLabel?: string;
  secondaryKey?: string;
  secondaryLabel?: string;
}

export function AreaTrendChart({
  data,
  currentKey = "current",
  currentLabel = "Current Period",
  previousKey = "previous",
  previousLabel = "Previous Period",
  secondaryKey,
  secondaryLabel,
  title = "Activity Trends",
  subtitle = "Daily volume compared with historical baseline",
  ...containerProps
}: AreaTrendChartProps) {
  const hasData = data && data.length > 0 && data.some((d) => (d[currentKey] || 0) > 0 || (secondaryKey && (d[secondaryKey] || 0) > 0));

  return (
    <ChartContainer
      title={title}
      subtitle={subtitle}
      icon={Icons.Analytics}
      iconColor="teal"
      isEmpty={!hasData}
      emptyTitle="No trend records found"
      emptyMessage="No case events or volume recorded across the selected dates."
      ariaLabel={`${title}: ${currentLabel} vs ${previousLabel}`}
      {...containerProps}
    >
      <div className="h-[280px] w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="trend-primary-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0B7A63" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#0B7A63" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="trend-secondary-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4338CA" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#4338CA" stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* Light dotted horizontal grid */}
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />

            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={{ stroke: "#E2E8F0" }}
              tick={{ fontSize: 13, fill: "#64748B" }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 13, fill: "#64748B" }}
            />

            {/* Sharp Tooltip Card */}
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-none border border-slate-300 bg-white p-2.5 shadow-[0_4px_12px_rgba(15,23,42,0.08)] text-xs">
                      <div className="font-semibold text-slate-800 pb-1.5 mb-1.5 border-b border-slate-100">
                        {label}
                      </div>
                      <div className="space-y-1">
                        {payload.map((entry, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="h-2 w-2 rounded-[1px] shrink-0"
                                style={{ backgroundColor: entry.color }}
                              />
                              <span className="text-slate-600 font-medium">
                                {entry.name}:
                              </span>
                            </div>
                            <span className="font-semibold text-slate-900 tabular-nums">
                              {entry.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            <Legend
              verticalAlign="top"
              align="right"
              iconType="square"
              iconSize={8}
              wrapperStyle={{ fontSize: "12px", paddingBottom: "12px" }}
            />

            {/* Optional previous period comparison line */}
            {previousKey && (
              <Area
                type="monotone"
                dataKey={previousKey}
                name={previousLabel}
                stroke="#94A3B8"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                fill="none"
                dot={false}
                isAnimationActive={true}
                animationDuration={600}
              />
            )}

            {/* Primary current period line with gradient fill */}
            <Area
              type="monotone"
              dataKey={currentKey}
              name={currentLabel}
              stroke="#0B7A63"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#trend-primary-grad)"
              activeDot={{ r: 5, fill: "#0B7A63", stroke: "#FFFFFF", strokeWidth: 2 }}
              isAnimationActive={true}
              animationDuration={600}
            />

            {/* Optional secondary line (e.g. Completed) */}
            {secondaryKey && (
              <Area
                type="monotone"
                dataKey={secondaryKey}
                name={secondaryLabel || "Completed"}
                stroke="#4338CA"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#trend-secondary-grad)"
                activeDot={{ r: 5, fill: "#4338CA", stroke: "#FFFFFF", strokeWidth: 2 }}
                isAnimationActive={true}
                animationDuration={600}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}
