"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Icons } from "@/components/ui/icons";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { PersonActivitySummary } from "@/lib/dashboard";
import { tokens } from "@/lib/tokens";

interface SuperAdminChartsProps {
  statusData: { name: string; value: number }[];
  categoryData: { name: string; value: number }[];
  therapists: PersonActivitySummary[];
}

const STATUS_COLORS: Record<string, string> = {
  New: "#64748B",
  Assigned: "#0284C7",
  Accepted: "#4338CA",
  "In Progress": "#0B7A63",
  "On Hold": "#D97706",
  Completed: "#059669",
  Discharged: "#059669",
  Cancelled: "#E11D48",
};

export function SuperAdminCharts({
  statusData,
  categoryData,
  therapists,
}: SuperAdminChartsProps) {
  const workloadData = therapists
    .filter((t) => t.role === "therapist")
    .map((t) => ({
      name: t.name.length > 14 ? `${t.name.slice(0, 12)}...` : t.name,
      fullName: t.name,
      sessions: t.breakdown.sessionsHeld,
      notes: t.breakdown.notesAdded,
      closed: t.breakdown.casesClosed,
      total: t.totalActions,
    }))
    .slice(0, 8);

  const hasStatusData = statusData.some((d) => d.value > 0);
  const hasCategoryData = categoryData.some((d) => d.value > 0);
  const hasWorkloadData = workloadData.some((d) => d.total > 0);
  const palette = tokens.colors.charts.palette;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Chart 1: Cases by Status */}
      <Card topAccent className="rounded-none">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Icons.Analytics className="h-4 w-4 text-[#4338CA]" />
              <span>Caseload by Status</span>
            </CardTitle>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Active</span>
          </div>
        </CardHeader>
        <CardContent>
          {!hasStatusData ? (
            <div className="h-56 flex items-center justify-center text-xs text-slate-500">
              No status data available
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={STATUS_COLORS[entry.name] || "#94a3b8"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: "0px",
                      color: "#0f172a",
                      fontSize: "12px",
                      boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconSize={8}
                    wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chart 2: Cases by Clinical Category */}
      <Card topAccent className="rounded-none">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Icons.Reports className="h-4 w-4 text-[#0B7A63]" />
              <span>Cases by Category</span>
            </CardTitle>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Clinical Focus</span>
          </div>
        </CardHeader>
        <CardContent>
          {!hasCategoryData ? (
            <div className="h-56 flex items-center justify-center text-xs text-slate-500">
              No category data available
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                >
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    angle={-20}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: "0px",
                      color: "#0f172a",
                      fontSize: "12px",
                      boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 0, 0, 0]}>
                    {categoryData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={palette[index % palette.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chart 3: Therapist Daily Workload */}
      <Card topAccent className="rounded-none">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Icons.Therapists className="h-4 w-4 text-[#0B7A63]" />
              <span>Therapist Daily Output</span>
            </CardTitle>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Selected Date</span>
          </div>
        </CardHeader>
        <CardContent>
          {!hasWorkloadData ? (
            <div className="h-56 flex items-center justify-center text-xs text-slate-500 text-center px-4">
              No clinical sessions or notes logged on this date
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={workloadData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                >
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: "0px",
                      color: "#0f172a",
                      fontSize: "12px",
                      boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconSize={8}
                    wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }}
                  />
                  <Bar dataKey="sessions" name="Sessions" fill="#0B7A63" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="notes" name="Notes" fill="#4338CA" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="closed" name="Discharged" fill="#0284C7" radius={[0, 0, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
