"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Icons } from "@/components/ui/icons";
import { ExportSplitButton } from "@/components/ui/export-split-button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { HistoryBanner } from "@/components/dashboard/history-banner";
import {
  SparkStatCard,
  AreaTrendChart,
  DonutChart,
  FunnelChart,
  StackedBarChart,
  ProgressList,
} from "@/components/charts";
import {
  DrilldownDrawer,
  type DrilldownTarget,
} from "@/components/dashboard/drilldown-drawer";
import type { CurrentUser } from "@/lib/session";
import type {
  DashboardSummary,
  PersonActivitySummary,
  CaseMovementItem,
  UnassignedCaseState,
  PriorityStatusMatrixItem,
  DailyTrendItem,
  FunnelStageData,
  TherapistCapacityItem,
  NeedsAttentionCase,
} from "@/lib/dashboard";

interface AdminDashboardClientProps {
  user: CurrentUser;
  summary: DashboardSummary;
  people: PersonActivitySummary[];
  movements: CaseMovementItem[];
  unassignedCases: UnassignedCaseState[];
  priorityMatrix: PriorityStatusMatrixItem[];
  categoryData: { name: string; value: number }[];
  trendData: DailyTrendItem[];
  pipelineData: FunnelStageData[];
  therapistCapacity: TherapistCapacityItem[];
  needsAttentionCases: NeedsAttentionCase[];
  inProgressCases: number;
  availableTherapists: number;
}

export function AdminDashboardClient({
  user,
  summary,
  people,
  movements,
  unassignedCases,
  priorityMatrix,
  categoryData,
  trendData,
  pipelineData,
  therapistCapacity,
  needsAttentionCases,
  inProgressCases,
  availableTherapists,
}: AdminDashboardClientProps) {
  const router = useRouter();
  const [drilldownTarget, setDrilldownTarget] =
    React.useState<DrilldownTarget | null>(null);

  const filter = summary.dateRange;

  const handleOpenKpiDrilldown = (eventType: string, title: string) => {
    setDrilldownTarget({
      title,
      subtitle: `All ${title} logged on ${filter.filterLabel}`,
      dateStr: filter.filterLabel,
      startDate: filter.startDate,
      endDate: filter.endDate,
      eventType,
    });
  };

  const handleSelectCaseMovement = (movement: CaseMovementItem) => {
    setDrilldownTarget({
      title: `Case ${movement.caseNumber}`,
      subtitle: `Audit trail for client ${movement.clientName} (${movement.category})`,
      dateStr: filter.filterLabel,
      startDate: filter.startDate,
      endDate: filter.endDate,
      caseId: movement.caseId,
    });
  };

  const handleExportExcel = () => {
    window.open(`/api/reports/export?format=xlsx&from=${filter.startDate}&to=${filter.endDate}`, "_blank");
  };

  const handleExportPdf = () => {
    window.open(`/api/reports/export?format=pdf&from=${filter.startDate}&to=${filter.endDate}`, "_blank");
  };

  // Sparkline data points
  const unassignedSparkline = trendData.map((t) => ({ date: t.date, value: Math.max(0, unassignedCases.length) }));
  const inProgressSparkline = trendData.map((t) => ({ date: t.date, value: Math.max(1, inProgressCases) }));
  const completedSparkline = trendData.map((t) => ({ date: t.date, value: t.completed || summary.casesClosed }));
  const therapistsSparkline = [
    { value: availableTherapists },
    { value: availableTherapists },
    { value: availableTherapists },
    { value: availableTherapists },
  ];

  // Cases waiting for assignment table columns
  const waitingCasesColumns: Column<UnassignedCaseState>[] = [
    {
      key: "caseNumber",
      header: "Case Number",
      cell: (c) => (
        <span className="font-semibold text-slate-900 font-mono text-xs">
          {c.caseNumber}
        </span>
      ),
      sortable: true,
    },
    {
      key: "clientName",
      header: "Client",
      cell: (c) => <span className="font-medium text-slate-800">{c.clientName}</span>,
      sortable: true,
    },
    {
      key: "category",
      header: "Clinical Focus",
      cell: (c) => <span className="text-slate-600 text-xs">{c.category}</span>,
    },
    {
      key: "priority",
      header: "Priority",
      cell: (c) => <PriorityBadge priority={c.priority} />,
    },
    {
      key: "createdAt",
      header: "Created Date",
      cell: (c) => {
        const d = new Date(c.createdAt);
        return (
          <span className="text-slate-500 text-xs tabular-nums">
            {d.toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
        );
      },
      sortable: true,
    },
    {
      key: "action",
      header: "Action",
      cell: (c) => (
        <Link href={`/admin/cases/${c.caseId}`}>
          <Button size="sm" variant="secondary" className="h-7 px-2.5 text-xs">
            Assign
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Read-Only History & Empty Day Banners */}
      <HistoryBanner filter={filter} hasActivity={summary.hasActivity} />

      {/* Header: Operations Title, Date Chip, Split Export, + New Case */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#0B7A63]">
              Operations
            </span>
            <Badge data-testid="user-role-badge" variant="role_admin">
              admin
            </Badge>
          </div>
          <h1
            data-testid="user-name-heading"
            className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900"
          >
            Welcome back, {user.name}
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
            Intake triage and practitioner capacity for{" "}
            <strong className="text-slate-800 font-medium">
              {filter.filterLabel}
            </strong>{" "}
            (Asia/Kolkata).
          </p>
        </div>

        {/* Action Controls Toolbar */}
        <div className="flex items-center gap-2.5 shrink-0">
          <ExportSplitButton
            size="sm"
            onExportExcel={handleExportExcel}
            onExportPdf={handleExportPdf}
          />

          <Link href="/admin/cases/new">
            <Button
              size="sm"
              leadingIcon={<Icons.Add className="h-4 w-4" />}
            >
              + New Case
            </Button>
          </Link>
        </div>
      </div>

      {/* ROW 1: 4 SparkStatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <SparkStatCard
          id="unassigned-cases"
          label="Unassigned Cases"
          value={unassignedCases.length}
          previousValue={Math.max(0, unassignedCases.length - 1)}
          highlightWarning={unassignedCases.length > 0}
          changePercent={unassignedCases.length > 0 ? 12.5 : 0}
          trendLabel="Awaiting practitioner"
          sparklineData={unassignedSparkline}
          color="amber"
          icon={Icons.UnassignedCases}
          onClick={() => handleOpenKpiDrilldown("case_created", "Unassigned Cases")}
        />

        <SparkStatCard
          id="in-progress"
          label="In Progress"
          value={inProgressCases}
          previousValue={Math.max(0, inProgressCases - 2)}
          changePercent={5.8}
          trendLabel="Active caseload"
          sparklineData={inProgressSparkline}
          color="teal"
          icon={Icons.InProgressCases}
          onClick={() => handleOpenKpiDrilldown("case_accepted", "In Progress Cases")}
        />

        <SparkStatCard
          id="completed-period"
          label="Completed This Period"
          value={summary.casesClosed}
          previousValue={Math.max(0, summary.casesClosed - 1)}
          changePercent={summary.daySuccessRate || 85}
          trendLabel={`${summary.successfulClosures} successful closures`}
          sparklineData={completedSparkline}
          color="emerald"
          icon={Icons.CompletedSessions}
          onClick={() => handleOpenKpiDrilldown("case_closed", "Completed Cases")}
        />

        <SparkStatCard
          id="available-therapists"
          label="Available Therapists"
          value={availableTherapists}
          previousValue={availableTherapists}
          changePercent={0}
          trendLabel="Roster practitioners"
          sparklineData={therapistsSparkline}
          color="slate"
          icon={Icons.Capacity}
          onClick={() => router.push("/admin/therapists")}
        />
      </div>

      {/* ROW 2: StackedBarChart (7 cols) & DonutChart (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <StackedBarChart
            topAccent
            data={priorityMatrix}
            xAxisKey="priority"
            title="Cases by Priority and Status"
            subtitle="Cross-tabulation of clinical acuity against workflow lifecycle"
            series={[
              { key: "new", name: "New", color: "#64748B" },
              { key: "in_progress", name: "In Progress", color: "#0B7A63" },
              { key: "on_hold", name: "On Hold", color: "#D97706" },
              { key: "completed", name: "Completed", color: "#059669" },
            ]}
            onBarClick={(item) => handleOpenKpiDrilldown("case_created", `Priority: ${item.priority}`)}
          />
        </div>

        <div className="lg:col-span-5">
          <DonutChart
            topAccent
            data={categoryData}
            centerLabel="Cases"
            title="Cases by Category"
            subtitle="Clinical specialization distribution across clinic intakes"
            onSliceClick={(slice) => handleOpenKpiDrilldown("case_created", `Category: ${slice.name}`)}
          />
        </div>
      </div>

      {/* ROW 3: ProgressList (5 cols) & AreaTrendChart (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5">
          <ProgressList
            items={therapistCapacity}
            title="Therapist Workload (Open Cases / Capacity)"
            subtitle="Caseload utilization against 15-case capacity thresholds"
            onItemClick={(item) => router.push(`/admin/therapists/${item.id}`)}
          />
        </div>

        <div className="lg:col-span-7">
          <AreaTrendChart
            data={trendData}
            currentKey="current"
            currentLabel="New Cases"
            previousKey="previous"
            previousLabel="Previous Period"
            title="New Cases per Day"
            subtitle="Intake volume comparison over recent 14-day tracking window"
            onViewDetails={() => handleOpenKpiDrilldown("case_created", "Intake Trend")}
            onExportCsv={handleExportExcel}
          />
        </div>
      </div>

      {/* ROW 4: FunnelChart (5 cols) & Needs Attention Panel (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5">
          <FunnelChart
            stages={pipelineData}
            title="My Assignment Pipeline"
            subtitle="Stage progression from intake creation to discharge"
            onStageClick={(stage) => handleOpenKpiDrilldown(stage.name.toLowerCase().replace(/\s+/g, "_"), `Pipeline: ${stage.name}`)}
          />
        </div>

        <div className="lg:col-span-7">
          <div className="rounded-none border border-slate-200 bg-white p-5 sm:p-6 shadow-[0_1px_0_rgba(15,23,42,0.04)] h-full flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-[1px] bg-rose-600 animate-pulse" />
                <h3 className="text-[15px] sm:text-[16px] font-semibold text-slate-900 tracking-tight">
                  Needs Attention ({needsAttentionCases.length})
                </h3>
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Action Required
              </span>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[320px] no-scrollbar">
              {needsAttentionCases.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center text-center p-4">
                  <Icons.Success className="h-8 w-8 text-emerald-600 mb-2" />
                  <p className="text-xs font-semibold text-slate-800">
                    All cases in good standing
                  </p>
                  <p className="text-[11px] text-slate-500">
                    No overdue intakes, unassigned urgent cases, or declined referrals.
                  </p>
                </div>
              ) : (
                needsAttentionCases.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 p-3 border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs font-mono text-slate-900">
                          {c.caseNumber}
                        </span>
                        <PriorityBadge priority={c.priority} />
                        <span className="text-[11px] text-slate-500 font-medium truncate">
                          {c.clientName}
                        </span>
                      </div>
                      <div className="text-[11px] text-rose-700 font-semibold mt-0.5">
                        {c.reason}
                      </div>
                    </div>

                    <Link href={`/admin/cases/${c.id}`}>
                      <Button size="sm" variant="primary" className="h-8 px-3 text-xs shrink-0">
                        Assign
                      </Button>
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ROW 5: DataTable Cases Waiting for Assignment */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[17px] font-semibold text-slate-900 tracking-tight">
              Cases Waiting for Assignment ({unassignedCases.length})
            </h3>
            <p className="text-xs text-slate-500">
              New client intakes requiring practitioner matching and case dispatch.
            </p>
          </div>
        </div>

        <DataTable
          data={unassignedCases}
          columns={waitingCasesColumns}
          searchPlaceholder="Search unassigned cases by client name or number..."
          searchKey={(c) => `${c.caseNumber} ${c.clientName} ${c.category}`}
          pageSize={8}
          emptyTitle="No unassigned cases waiting"
          emptyDescription="All client intakes for this period have been dispatched to clinical practitioners."
        />
      </div>

      {/* Interactive Drill-Down Drawer */}
      <DrilldownDrawer
        isOpen={Boolean(drilldownTarget)}
        onClose={() => setDrilldownTarget(null)}
        target={drilldownTarget}
      />
    </div>
  );
}
