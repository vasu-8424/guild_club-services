"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Icons } from "@/components/ui/icons";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { exportReportsToExcel, exportReportsToPdf } from "@/lib/report-exports";
import type { SuperAdminReportsData } from "@/lib/dashboard";
import { tokens } from "@/lib/tokens";

interface ReportsClientProps {
  data: SuperAdminReportsData;
  dateRangeLabel: string;
  startDate?: string;
  endDate?: string;
}

export function ReportsClient({
  data,
  dateRangeLabel,
  startDate,
  endDate,
}: ReportsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isExportingExcel, setIsExportingExcel] = React.useState(false);
  const [isExportingPdf, setIsExportingPdf] = React.useState(false);

  const [fromInput, setFromInput] = React.useState(startDate || "");
  const [toInput, setToInput] = React.useState(endDate || "");

  const handleApplyFilter = (preset: "all" | "30" | "90" | "ytd") => {
    const today = new Date().toISOString().slice(0, 10);
    const params = new URLSearchParams();

    if (preset === "all") {
      router.push(pathname);
      return;
    }

    if (preset === "30") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      params.set("from", d.toISOString().slice(0, 10));
      params.set("to", today);
    } else if (preset === "90") {
      const d = new Date();
      d.setDate(d.getDate() - 90);
      params.set("from", d.toISOString().slice(0, 10));
      params.set("to", today);
    } else if (preset === "ytd") {
      const currentYear = new Date().getFullYear();
      params.set("from", `${currentYear}-01-01`);
      params.set("to", today);
    }

    router.push(`${pathname}?${params.toString()}`);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromInput || !toInput) return;
    const params = new URLSearchParams();
    params.set("from", fromInput);
    params.set("to", toInput);
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleExportExcel = () => {
    setIsExportingExcel(true);
    try {
      exportReportsToExcel(data, dateRangeLabel);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportPdf = () => {
    setIsExportingPdf(true);
    try {
      exportReportsToPdf(data, dateRangeLabel);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const palette = tokens.colors.charts.palette;

  return (
    <div className="space-y-6">
      {/* Header & Export Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-none border border-slate-200 border-t-2 border-t-[#0B7A63] bg-white p-6 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded-[2px] bg-teal-50 border border-teal-200 px-2 py-0.5 text-[10px] font-bold text-teal-800 uppercase tracking-wider">
              Executive Analytics & Governance
            </span>
            <span className="text-xs text-slate-400">&bull; {dateRangeLabel}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
            Clinical Operations & Success Analytics
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Comprehensive oversight across therapeutic outcomes, acceptance latencies, therapist workloads, and trajectory statistics.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="export-excel-button"
            onClick={handleExportExcel}
            isLoading={isExportingExcel}
            leadingIcon={<Icons.FileExcel className="h-4 w-4 text-emerald-600" />}
          >
            Export to Excel (.xlsx)
          </Button>

          <Button
            type="button"
            size="sm"
            data-testid="export-pdf-button"
            onClick={handleExportPdf}
            isLoading={isExportingPdf}
            leadingIcon={<Icons.FilePdf className="h-4 w-4" />}
          >
            Export to PDF
          </Button>
        </div>
      </div>

      {/* Date Range Filter Bar */}
      <div className="rounded-none border border-slate-200 bg-slate-50/70 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-500 font-semibold mr-1 flex items-center gap-1">
            <Icons.Filter className="h-3.5 w-3.5 text-slate-400" />
            Timeframe:
          </span>
          <button
            type="button"
            onClick={() => handleApplyFilter("all")}
            className={`rounded-none px-3 py-1.5 font-semibold uppercase tracking-wider transition-colors border ${
              !startDate && !endDate
                ? "bg-[#0B7A63] text-white border-[#085d4b]"
                : "bg-white text-slate-700 hover:bg-slate-100 border-slate-200"
            }`}
          >
            All Time
          </button>
          <button
            type="button"
            onClick={() => handleApplyFilter("30")}
            className="rounded-none px-3 py-1.5 bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 font-semibold uppercase tracking-wider"
          >
            Last 30 Days
          </button>
          <button
            type="button"
            onClick={() => handleApplyFilter("90")}
            className="rounded-none px-3 py-1.5 bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 font-semibold uppercase tracking-wider"
          >
            Last 90 Days
          </button>
          <button
            type="button"
            onClick={() => handleApplyFilter("ytd")}
            className="rounded-none px-3 py-1.5 bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 font-semibold uppercase tracking-wider"
          >
            Year to Date (YTD)
          </button>
        </div>

        <form onSubmit={handleCustomSubmit} className="flex items-center gap-2">
          <input
            type="date"
            value={fromInput}
            onChange={(e) => setFromInput(e.target.value)}
            className="rounded-none border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={toInput}
            onChange={(e) => setToInput(e.target.value)}
            className="rounded-none border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
          />
          <Button type="submit" size="sm" variant="secondary" className="h-7 text-xs px-2.5">
            Apply
          </Button>
        </form>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          id="rep-success-rate"
          title="Success Rate"
          value={`${data.overallMetrics.overallSuccessRate}%`}
          subtitle={`${data.overallMetrics.successfulClosures} of ${data.overallMetrics.totalClosed} closed`}
          icon={<Icons.SuccessRate className="h-4 w-4" />}
          colorScheme="emerald"
        />

        <KpiCard
          id="rep-total-cases"
          title="Cases Intake"
          value={data.overallMetrics.totalCases}
          subtitle="Registered cases"
          icon={<Icons.Cases className="h-4 w-4" />}
          colorScheme="blue"
        />

        <KpiCard
          id="rep-resolution-time"
          title="Avg Resolution"
          value={`${data.overallMetrics.avgResolutionDays}d`}
          subtitle="From intake to discharge"
          icon={<Icons.Clock className="h-4 w-4" />}
          colorScheme="indigo"
        />

        <KpiCard
          id="rep-acceptance-time"
          title="Avg Acceptance"
          value={`${data.overallMetrics.avgAcceptanceHours}h`}
          subtitle="Assigned to accepted"
          icon={<Icons.Check className="h-4 w-4" />}
          colorScheme="emerald"
        />

        <KpiCard
          id="rep-reassignment"
          title="Reassignment Rate"
          value={`${data.overallMetrics.reassignmentRate}%`}
          subtitle="Declined / Assigned"
          icon={<Icons.TrendDown className="h-4 w-4" />}
          colorScheme="amber"
        />

        <KpiCard
          id="rep-sessions"
          title="Sessions Held"
          value={data.overallMetrics.totalSessionsHeld}
          subtitle="Appointments completed"
          icon={<Icons.Calendar className="h-4 w-4" />}
          colorScheme="purple"
        />
      </div>

      {/* Visual Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Monthly Trend Chart */}
        <Card topAccent className="lg:col-span-2 rounded-none">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Icons.Reports className="h-4 w-4 text-[#0B7A63]" />
                <span>Monthly Intake, Discharges & Success Rate</span>
              </CardTitle>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Past 6 Months</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.monthlyTrends}
                  margin={{ top: 10, right: 10, left: -20, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: "#64748b" }} />
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
                    wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                  />
                  <Bar dataKey="casesCreated" name="Cases Intake" fill="#0284C7" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="casesClosed" name="Discharged" fill="#64748B" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="successfulClosed" name="Successful Outcome" fill="#0B7A63" radius={[0, 0, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Clinical Categories Pie Chart */}
        <Card topAccent className="rounded-none">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Icons.Analytics className="h-4 w-4 text-[#4338CA]" />
                <span>Cases by Category</span>
              </CardTitle>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Distribution</span>
            </div>
          </CardHeader>
          <CardContent>
            {data.categoryBreakdown.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                No category data on file
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="count"
                      nameKey="category"
                    >
                      {data.categoryBreakdown.map((_, index) => (
                        <Cell
                          key={`cat-cell-${index}`}
                          fill={palette[index % palette.length]}
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
      </div>

      {/* Detailed Therapist Performance Table */}
      <Card className="rounded-none border-slate-200 shadow-[0_1px_0_rgba(15,23,42,0.04)] overflow-hidden">
        <CardHeader className="border-b border-slate-200 pb-3 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Icons.Therapists className="h-4 w-4 text-[#0B7A63]" />
                <span>Therapist Workload & Performance Ledger</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Clinical efficiency, acceptance metrics, session completions, and discharge success rates by practitioner.
              </CardDescription>
            </div>
            <span className="rounded-[2px] bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700 tabular-nums">
              {data.therapistPerformance.length} practitioners
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {data.therapistPerformance.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No therapist records found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">Therapist Practitioner</th>
                    <th className="px-5 py-3">Specialization</th>
                    <th className="px-5 py-3 text-center">Assigned</th>
                    <th className="px-5 py-3 text-center">Accepted</th>
                    <th className="px-5 py-3 text-center">Declined</th>
                    <th className="px-5 py-3 text-center">Sessions Held</th>
                    <th className="px-5 py-3 text-center">Discharged</th>
                    <th className="px-5 py-3 text-center">Success Rate</th>
                    <th className="px-5 py-3 text-right">Avg Resolution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {data.therapistPerformance.map((t) => (
                    <tr key={t.therapistId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-slate-900">
                        {t.therapistName}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{t.specialization}</td>
                      <td className="px-5 py-3.5 text-center text-slate-800 tabular-nums">{t.totalAssigned}</td>
                      <td className="px-5 py-3.5 text-center text-[#0B7A63] font-semibold tabular-nums">{t.acceptedCount}</td>
                      <td className="px-5 py-3.5 text-center text-rose-700 tabular-nums">{t.declinedCount}</td>
                      <td className="px-5 py-3.5 text-center font-bold text-slate-900 tabular-nums">{t.sessionsHeld}</td>
                      <td className="px-5 py-3.5 text-center text-slate-700 tabular-nums">{t.casesClosed}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span
                          className={`rounded-[2px] border px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                            t.casesClosed === 0
                              ? "bg-slate-100 text-slate-500 border-slate-200"
                              : t.successRate >= 70
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-amber-50 text-amber-800 border-amber-200"
                          }`}
                        >
                          {t.casesClosed > 0 ? `${t.successRate}%` : "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-slate-600 tabular-nums">
                        {t.avgResolutionDays > 0 ? `${t.avgResolutionDays} days` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
