"use client";

import * as React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { ChartContainer, type ChartContainerProps } from "./ChartContainer";
import { Icons } from "@/components/ui/icons";
import { tokens } from "@/lib/tokens";
import { cn } from "@/lib/utils";

export interface DonutSegment {
  name: string;
  value: number;
  color?: string;
  [key: string]: any;
}

export interface DonutChartProps extends Omit<ChartContainerProps, "children"> {
  data: DonutSegment[];
  centerLabel?: string;
  onSliceClick?: (segment: DonutSegment) => void;
}

export function DonutChart({
  data,
  centerLabel = "Total",
  onSliceClick,
  title = "Distribution",
  subtitle = "Breakdown by category or status",
  ...containerProps
}: DonutChartProps) {
  const total = React.useMemo(
    () => data.reduce((acc, curr) => acc + (curr.value || 0), 0),
    [data]
  );

  const hasData = total > 0;

  const palette = tokens.colors.charts.palette;

  const dataWithPercentage = React.useMemo(() => {
    return data.map((item, idx) => ({
      ...item,
      color: item.color || palette[idx % palette.length],
      percent: total > 0 ? ((item.value / total) * 100).toFixed(1) : "0.0",
    }));
  }, [data, total, palette]);

  return (
    <ChartContainer
      title={title}
      subtitle={subtitle}
      icon={Icons.Analytics}
      iconColor="indigo"
      isEmpty={!hasData}
      emptyTitle="No categorization available"
      emptyMessage="No active cases or events have been logged for this selection."
      ariaLabel={`${title}: Total ${total} items distributed across ${data.length} categories`}
      {...containerProps}
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 h-full pt-1">
        {/* Ring Chart with Total in Center */}
        <div className="relative h-[220px] w-full sm:w-[220px] shrink-0 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={dataWithPercentage}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={88}
                paddingAngle={2}
                dataKey="value"
                onClick={(entry: any) => {
                  const seg = entry?.payload || entry;
                  if (seg && onSliceClick) onSliceClick(seg as DonutSegment);
                }}
                isAnimationActive={true}
                animationDuration={600}
                className="cursor-pointer"
              >
                {dataWithPercentage.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    stroke="#FFFFFF"
                    strokeWidth={1.5}
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload as DonutSegment & { percent: string };
                    return (
                      <div className="rounded-none border border-slate-300 bg-white p-2 text-xs shadow-md">
                        <div className="font-semibold text-slate-800">{d.name}</div>
                        <div className="text-slate-600 mt-0.5">
                          Count: <strong className="text-slate-900">{d.value}</strong> ({d.percent}%)
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Centered Total */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-semibold tabular-nums text-slate-900 tracking-tight">
              {new Intl.NumberFormat("en-IN").format(total)}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {centerLabel}
            </span>
          </div>
        </div>

        {/* Legend List on the Right */}
        <div className="flex-1 w-full space-y-2 border-t sm:border-t-0 sm:border-l border-slate-100 sm:pl-4 pt-3 sm:pt-0 max-h-[220px] overflow-y-auto no-scrollbar">
          {dataWithPercentage.map((item, idx) => (
            <div
              key={idx}
              onClick={() => onSliceClick?.(item)}
              className={cn(
                "flex items-center justify-between text-xs py-1 px-1.5 transition-colors",
                onSliceClick && "cursor-pointer hover:bg-slate-50"
              )}
            >
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span
                  className="h-2.5 w-2.5 rounded-[1px] shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate font-medium text-slate-700">
                  {item.name}
                </span>
              </div>
              <div className="flex items-center gap-2.5 shrink-0 tabular-nums">
                <span className="font-semibold text-slate-900">{item.value}</span>
                <span className="text-slate-400 text-[11px] w-10 text-right">
                  {item.percent}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ChartContainer>
  );
}
