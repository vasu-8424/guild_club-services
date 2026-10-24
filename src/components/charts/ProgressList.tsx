"use client";

import * as React from "react";
import { ChartContainer, type ChartContainerProps } from "./ChartContainer";
import { Avatar } from "@/components/ui/avatar";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export interface TherapistWorkloadItem {
  id: string;
  name: string;
  specialization?: string;
  openCases: number;
  maxCapacity: number; // e.g. 15 cases
  onAssign?: () => void;
}

export interface ProgressListProps extends Omit<ChartContainerProps, "children"> {
  items: TherapistWorkloadItem[];
  onItemClick?: (item: TherapistWorkloadItem) => void;
}

export function ProgressList({
  items,
  onItemClick,
  title = "Therapist Workload & Capacity",
  subtitle = "Open cases vs maximum active capacity limit",
  ...containerProps
}: ProgressListProps) {
  const hasData = items && items.length > 0;

  const getThresholdColor = (pct: number) => {
    if (pct > 90) return { bar: "bg-rose-600", text: "text-rose-700", badge: "bg-rose-50 text-rose-700 border-rose-200" };
    if (pct >= 70) return { bar: "bg-amber-500", text: "text-amber-700", badge: "bg-amber-50 text-amber-700 border-amber-200" };
    return { bar: "bg-emerald-600", text: "text-emerald-700", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  };

  return (
    <ChartContainer
      title={title}
      subtitle={subtitle}
      icon={Icons.Capacity}
      iconColor="teal"
      isEmpty={!hasData}
      emptyTitle="No therapists found"
      emptyMessage="No practitioners are registered in the clinic roster."
      ariaLabel={`${title}: ${items.length} therapists monitored`}
      {...containerProps}
    >
      <div className="space-y-3.5 pt-1">
        {items.map((item) => {
          const capacity = item.maxCapacity || 15;
          const ratio = Math.min(100, Math.round((item.openCases / capacity) * 100));
          const colors = getThresholdColor(ratio);

          return (
            <div
              key={item.id}
              onClick={() => onItemClick?.(item)}
              className={cn(
                "group space-y-1.5 p-1 transition-colors",
                onItemClick && "cursor-pointer hover:bg-slate-50/70"
              )}
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <Avatar
                    name={item.name}
                    size="sm"
                    variant="brand"
                    className="h-7 w-7 text-[10px]"
                  />
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-800 truncate block">
                      {item.name}
                    </span>
                    {item.specialization && (
                      <span className="text-[10px] text-slate-400 truncate block">
                        {item.specialization}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 tabular-nums">
                  <span className="font-semibold text-slate-900">
                    {item.openCases} / {capacity}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-bold px-1.5 py-0.2 rounded-[2px] border",
                      colors.badge
                    )}
                  >
                    {ratio}%
                  </span>
                </div>
              </div>

              {/* Progress bar with 70% and 90% threshold markers */}
              <div className="relative h-2 w-full bg-slate-100 rounded-none overflow-hidden border border-slate-200/50">
                <div
                  className={cn("h-full rounded-none transition-all duration-500", colors.bar)}
                  style={{ width: `${ratio}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </ChartContainer>
  );
}
