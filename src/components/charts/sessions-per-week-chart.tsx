"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface SessionsPerWeekChartProps {
  startDate: string; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD
  sessionDates: string[]; // array of YYYY-MM-DD
}

export function SessionsPerWeekChart({
  startDate,
  endDate,
  sessionDates,
}: SessionsPerWeekChartProps) {
  const chartData = useMemo(() => {
    if (!startDate) return [];

    const [sY, sM, sD] = startDate.split("-").map(Number);
    const start = new Date(Date.UTC(sY, sM - 1, sD));

    const endTarget = endDate || new Date().toISOString().slice(0, 10);
    const [eY, eM, eD] = endTarget.split("-").map(Number);
    const end = new Date(Date.UTC(eY, eM - 1, eD));

    // Calculate total weeks (at least 1 week, at most 12 weeks)
    const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const totalWeeks = Math.max(1, Math.ceil(diffDays / 7));

    const weeks: Array<{ week: string; count: number }> = [];

    for (let w = 0; w < totalWeeks; w++) {
      const wStart = new Date(start);
      wStart.setUTCDate(wStart.getUTCDate() + w * 7);

      const wEnd = new Date(wStart);
      wEnd.setUTCDate(wEnd.getUTCDate() + 6);

      const wStartStr = wStart.toISOString().slice(0, 10);
      const wEndStr = wEnd.toISOString().slice(0, 10);

      const count = sessionDates.filter((d) => d >= wStartStr && d <= wEndStr).length;

      weeks.push({
        week: `Wk ${w + 1}`,
        count,
      });
    }

    return weeks;
  }, [startDate, endDate, sessionDates]);

  if (chartData.length === 0) {
    return (
      <div className="h-44 flex items-center justify-center text-xs text-stone-400 bg-stone-50 border border-stone-200">
        No session data available for weekly chart.
      </div>
    );
  }

  return (
    <div
      data-testid="sessions-per-week-chart"
      className="bg-white border border-stone-200 p-4 rounded-none shadow-2xs"
    >
      <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
        Sessions Per Week
      </h4>
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E5E4" />
            <XAxis
              dataKey="week"
              tickLine={false}
              axisLine={{ stroke: "#D6D3D1" }}
              tick={{ fontSize: 10, fill: "#78716C" }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={{ stroke: "#D6D3D1" }}
              tick={{ fontSize: 10, fill: "#78716C" }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-stone-900 text-white p-2 text-xs rounded-none shadow-md">
                      <p className="font-semibold">{payload[0].payload.week}</p>
                      <p className="text-emerald-400">{payload[0].value} Sessions</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar
              dataKey="count"
              fill="#0B7A63"
              radius={[0, 0, 0, 0]}
              maxBarSize={32}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
