"use client";

import * as React from "react";
import { ChartContainer, type ChartContainerProps } from "./ChartContainer";
import { Avatar } from "@/components/ui/avatar";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export interface LeaderboardItem {
  id: string;
  name: string;
  subtitle?: string;
  value: number;
  valueLabel?: string;
  percentage?: number;
  avatarVariant?: "brand" | "slate" | "amber" | "sky" | "rose" | "indigo";
}

export interface HorizontalBarLeaderboardProps
  extends Omit<ChartContainerProps, "children"> {
  items: LeaderboardItem[];
  maxVal?: number;
  barColor?: string;
  onItemClick?: (item: LeaderboardItem) => void;
}

export function HorizontalBarLeaderboard({
  items,
  maxVal,
  barColor = "#0B7A63",
  onItemClick,
  title = "Rankings & Productivity",
  subtitle = "Performance benchmarks across practitioners",
  ...containerProps
}: HorizontalBarLeaderboardProps) {
  const computedMax = React.useMemo(() => {
    if (maxVal) return maxVal;
    const values = items.map((i) => i.value);
    return Math.max(...values, 1);
  }, [items, maxVal]);

  const hasData = items && items.length > 0 && items.some((i) => i.value > 0);

  return (
    <ChartContainer
      title={title}
      subtitle={subtitle}
      icon={Icons.SuccessRate}
      iconColor="teal"
      isEmpty={!hasData}
      emptyTitle="No activity recorded"
      emptyMessage="No actions or productivity metrics registered for this timeframe."
      ariaLabel={`${title}: ${items.length} contributors ranked`}
      {...containerProps}
    >
      <div className="space-y-3 pt-1">
        {items.map((item, idx) => {
          const barWidth = Math.max(6, Math.min(100, (item.value / computedMax) * 100));

          return (
            <div
              key={item.id || idx}
              onClick={() => onItemClick?.(item)}
              className={cn(
                "group space-y-1 p-1 transition-colors",
                onItemClick && "cursor-pointer hover:bg-slate-50/80"
              )}
            >
              {/* Row Header: Rank + Avatar + Name + Value */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <span className="text-[11px] font-bold text-slate-400 w-4 text-center tabular-nums">
                    #{idx + 1}
                  </span>
                  <Avatar
                    name={item.name}
                    size="sm"
                    variant={item.avatarVariant || "brand"}
                    className="h-7 w-7 text-[10px]"
                  />
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 truncate">
                      {item.name}
                    </div>
                    {item.subtitle && (
                      <div className="text-[10px] text-slate-400 truncate">
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 tabular-nums">
                  <span className="font-semibold text-slate-900 text-sm">
                    {item.valueLabel || item.value}
                  </span>
                  {item.percentage != null && (
                    <span className="text-[11px] text-slate-500 font-medium">
                      ({item.percentage}%)
                    </span>
                  )}
                </div>
              </div>

              {/* Sharp Horizontal Bar */}
              <div className="h-2 w-full bg-slate-100 rounded-none overflow-hidden ml-6.5 max-w-[calc(100%-1.625rem)]">
                <div
                  className="h-full rounded-none transition-all duration-500 ease-out"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: barColor,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </ChartContainer>
  );
}
