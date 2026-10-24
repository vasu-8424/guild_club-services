"use client";

import * as React from "react";
import { ChartContainer, type ChartContainerProps } from "./ChartContainer";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export interface FunnelStage {
  name: string;
  count: number;
  color?: string;
}

export interface FunnelChartProps extends Omit<ChartContainerProps, "children"> {
  stages: FunnelStage[];
  onStageClick?: (stage: FunnelStage) => void;
}

export function FunnelChart({
  stages,
  onStageClick,
  title = "Case Pipeline",
  subtitle = "Throughput progression & conversion rates across stages",
  ...containerProps
}: FunnelChartProps) {
  const maxCount = React.useMemo(() => {
    return Math.max(...stages.map((s) => s.count), 1);
  }, [stages]);

  const hasData = stages.some((s) => s.count > 0);

  const stageColors = [
    "#64748B", // New - Slate
    "#0284C7", // Assigned - Sky
    "#4338CA", // Accepted - Indigo
    "#0B7A63", // In Progress - Teal
    "#059669", // Completed - Emerald
  ];

  return (
    <ChartContainer
      title={title}
      subtitle={subtitle}
      icon={Icons.Analytics}
      iconColor="teal"
      isEmpty={!hasData}
      emptyTitle="No pipeline activity recorded"
      emptyMessage="No active cases transitioning through the clinical pipeline for this range."
      ariaLabel={`${title}: 5 pipeline stages from New to Completed`}
      {...containerProps}
    >
      <div className="space-y-3.5 pt-2">
        {stages.map((stage, idx) => {
          const widthPercent = Math.max(8, (stage.count / maxCount) * 100);
          const prevCount = idx > 0 ? stages[idx - 1].count : null;
          const dropOffPercent =
            prevCount != null && prevCount > 0
              ? Math.round(((prevCount - stage.count) / prevCount) * 100)
              : null;
          const conversionRate =
            prevCount != null && prevCount > 0
              ? Math.round((stage.count / prevCount) * 100)
              : null;

          const barColor = stage.color || stageColors[idx % stageColors.length];

          return (
            <div
              key={stage.name}
              onClick={() => onStageClick?.(stage)}
              className={cn(
                "group relative space-y-1 transition-opacity",
                onStageClick && "cursor-pointer"
              )}
            >
              {/* Stage label and metric count */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-[1px] shrink-0"
                    style={{ backgroundColor: barColor }}
                  />
                  <span className="font-semibold text-slate-800">
                    {stage.name}
                  </span>
                </div>
                <div className="flex items-center gap-3 tabular-nums">
                  <span className="font-semibold text-slate-900 text-sm">
                    {stage.count}
                  </span>
                  {conversionRate != null && (
                    <span className="text-[11px] font-medium text-slate-400">
                      ({conversionRate}%)
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar (sharp, 0 radius) */}
              <div className="h-6 w-full bg-slate-100/90 rounded-none overflow-hidden relative border border-slate-200/60">
                <div
                  className="h-full rounded-none transition-all duration-500 ease-out flex items-center justify-end pr-2"
                  style={{
                    width: `${widthPercent}%`,
                    backgroundColor: barColor,
                  }}
                >
                  {widthPercent > 25 && (
                    <span className="text-[10px] font-semibold text-white drop-shadow-xs">
                      {stage.count}
                    </span>
                  )}
                </div>
              </div>

              {/* Drop-off indicator between stages */}
              {dropOffPercent != null && dropOffPercent > 0 && idx < stages.length && (
                <div className="text-[10px] text-slate-400 pl-4 flex items-center gap-1 font-medium">
                  <span>↓ {dropOffPercent}% drop-off from previous stage</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ChartContainer>
  );
}
