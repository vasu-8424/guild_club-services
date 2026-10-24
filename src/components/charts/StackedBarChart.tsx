"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { ChartContainer, type ChartContainerProps } from "./ChartContainer";
import { Icons } from "@/components/ui/icons";

export interface StackedBarSeries {
  key: string;
  name: string;
  color: string;
}

export interface StackedBarChartProps extends Omit<ChartContainerProps, "children"> {
  data: any[];
  series: StackedBarSeries[];
  xAxisKey?: string;
  onBarClick?: (item: any) => void;
}

export function StackedBarChart({
  data,
  series,
  xAxisKey = "name",
  onBarClick,
  title = "Workload Breakdown",
  subtitle = "Distribution across operational dimensions",
  ...containerProps
}: StackedBarChartProps) {
  const hasData =
    data &&
    data.length > 0 &&
    data.some((d) => series.some((s) => (d[s.key] || 0) > 0));

  return (
    <ChartContainer
      title={title}
      subtitle={subtitle}
      icon={Icons.Reports}
      iconColor="teal"
      isEmpty={!hasData}
      emptyTitle="No data available"
      emptyMessage="No activity records or metrics found for this period."
      ariaLabel={`${title}: Stacked breakdown across ${data.length} categories`}
      {...containerProps}
    >
      <div className="h-[280px] w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
            onClick={(state: any) => {
              if (state && state.activePayload && state.activePayload.length) {
                onBarClick?.(state.activePayload[0].payload);
              }
            }}
          >
            {/* Light dotted horizontal grid */}
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />

            <XAxis
              dataKey={xAxisKey}
              tickLine={false}
              axisLine={{ stroke: "#E2E8F0" }}
              tick={{ fontSize: 13, fill: "#64748B" }}
              interval={0}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 13, fill: "#64748B" }}
            />

            {/* Sharp Tooltip Card */}
            <Tooltip
              cursor={{ fill: "rgba(15, 23, 42, 0.04)" }}
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

            {/* Sharp 0px radius stacked bars with flat fills */}
            {series.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                stackId="stack"
                fill={s.color}
                radius={[0, 0, 0, 0]}
                isAnimationActive={true}
                animationDuration={600}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}
