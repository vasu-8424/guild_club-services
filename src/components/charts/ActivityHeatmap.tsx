"use client";

import * as React from "react";
import { ChartContainer, type ChartContainerProps } from "./ChartContainer";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export interface HeatmapDay {
  date: string; // "YYYY-MM-DD"
  displayDate: string; // "23 Oct 2026"
  count: number;
}

export interface ActivityHeatmapProps extends Omit<ChartContainerProps, "children"> {
  days: HeatmapDay[]; // 12 weeks = 84 days
  onSelectDate?: (dateStr: string) => void;
  selectedDate?: string;
}

export function ActivityHeatmap({
  days,
  onSelectDate,
  selectedDate,
  title = "Daily Activity (Last 12 Weeks)",
  subtitle = "Interactive audit intensity across the clinical governance calendar",
  ...containerProps
}: ActivityHeatmapProps) {
  const [hoveredDay, setHoveredDay] = React.useState<HeatmapDay | null>(null);

  // Group days into 12 weeks (each week has 7 days)
  const weeks = React.useMemo(() => {
    const result: HeatmapDay[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [days]);

  const totalEvents = React.useMemo(() => {
    return days.reduce((acc, d) => acc + (d.count || 0), 0);
  }, [days]);

  const getIntensityClass = (count: number) => {
    if (!count || count === 0) return "bg-slate-100 hover:bg-slate-200 border-slate-200/60";
    if (count <= 2) return "bg-[#0B7A63]/25 hover:bg-[#0B7A63]/35 border-[#0B7A63]/40";
    if (count <= 5) return "bg-[#0B7A63]/50 hover:bg-[#0B7A63]/60 border-[#0B7A63]/60";
    if (count <= 10) return "bg-[#0B7A63]/80 hover:bg-[#0B7A63]/90 border-[#0B7A63]";
    return "bg-[#0B7A63] hover:bg-[#085d4b] border-[#064336]";
  };

  const dayLabels = ["Mon", "Wed", "Fri", "Sun"];

  return (
    <ChartContainer
      title={title}
      subtitle={subtitle}
      icon={Icons.Calendar}
      iconColor="teal"
      isEmpty={days.length === 0}
      emptyTitle="No activity history available"
      emptyMessage="Activity log starts recording with new clinic cases and sessions."
      ariaLabel={`${title}: ${totalEvents} total logged events across 12 weeks`}
      {...containerProps}
    >
      <div className="flex flex-col justify-between h-full pt-1">
        {/* Heatmap Grid */}
        <div className="overflow-x-auto no-scrollbar py-2">
          <div className="min-w-[560px] flex gap-2">
            {/* Day of Week Labels */}
            <div className="flex flex-col justify-between text-[10px] font-semibold text-slate-400 py-1 pr-1 select-none">
              <span>Mon</span>
              <span>Wed</span>
              <span>Fri</span>
              <span>Sun</span>
            </div>

            {/* Weeks Columns */}
            <div className="flex-1 flex gap-1.5">
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="flex-1 flex flex-col gap-1.5">
                  {week.map((day) => {
                    const isSelected = selectedDate === day.date;
                    return (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => onSelectDate?.(day.date)}
                        onMouseEnter={() => setHoveredDay(day)}
                        onMouseLeave={() => setHoveredDay(null)}
                        className={cn(
                          "h-3.5 w-full rounded-[1px] border transition-all duration-100 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#0B7A63]",
                          getIntensityClass(day.count),
                          isSelected && "ring-2 ring-slate-900 ring-offset-1 z-10"
                        )}
                        aria-label={`${day.displayDate}: ${day.count} events`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer: Live Hover Tooltip & 5-Step Legend */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 pt-3 mt-2 text-xs">
          {/* Active Hover readout */}
          <div className="text-slate-600 font-medium h-5 flex items-center">
            {hoveredDay ? (
              <span>
                <strong className="text-slate-900">{hoveredDay.displayDate}</strong>:{" "}
                <span className="text-[#0B7A63] font-semibold">{hoveredDay.count} events</span> logged
              </span>
            ) : (
              <span className="text-slate-400 text-[11px]">
                Click any day cell to filter the entire dashboard
              </span>
            )}
          </div>

          {/* 5-Step Teal Scale Legend */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
            <span>Less</span>
            <span className="h-3 w-3 rounded-[1px] bg-slate-100 border border-slate-200/60" />
            <span className="h-3 w-3 rounded-[1px] bg-[#0B7A63]/25 border border-[#0B7A63]/40" />
            <span className="h-3 w-3 rounded-[1px] bg-[#0B7A63]/50 border border-[#0B7A63]/60" />
            <span className="h-3 w-3 rounded-[1px] bg-[#0B7A63]/80 border border-[#0B7A63]" />
            <span className="h-3 w-3 rounded-[1px] bg-[#0B7A63] border border-[#064336]" />
            <span>More</span>
          </div>
        </div>
      </div>
    </ChartContainer>
  );
}
