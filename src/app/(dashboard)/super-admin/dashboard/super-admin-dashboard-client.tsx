"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Icons, IconTile } from "@/components/ui/icons";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ExportSplitButton } from "@/components/ui/export-split-button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { HistoryBanner } from "@/components/dashboard/history-banner";
import {
  SparkStatCard,
  RadialGauge,
  AreaTrendChart,
  DonutChart,
  FunnelChart,
  StackedBarChart,
  HorizontalBarLeaderboard,
  ActivityHeatmap,
  type LeaderboardItem,
} from "@/components/charts";
import {
  DrilldownDrawer,
  type DrilldownTarget,
} from "@/components/dashboard/drilldown-drawer";
import { MovementsList } from "@/components/dashboard/movements-list";
import type { CurrentUser } from "@/lib/session";
import type {
  DashboardSummary,
  PersonActivitySummary,
  CaseMovementItem,
  ActivityHeatmapDay,
  FunnelStageData,
  DailyTrendItem,
  TherapistCapacityItem,
  AdminProductivityItem,
} from "@/lib/dashboard";
import { getTodayIST, getDaysAgoIST } from "@/lib/date-utils";

interface SuperAdminDashboardClientProps {
  user: CurrentUser;
  summary: DashboardSummary;
  people: PersonActivitySummary[];
  movements: CaseMovementItem[];
  statusData: { name: string; value: number }[];
  categoryData: { name: string; value: number }[];
  adminsCount: number;
  therapistsCount: number;
  activeCasesCount: number;
  totalCasesCount: number;
  heatmapData: ActivityHeatmapDay[];
  pipelineData: FunnelStageData[];
  trendData: DailyTrendItem[];
  therapistCapacity: TherapistCapacityItem[];
  adminProductivity: AdminProductivityItem[];
}

export function SuperAdminDashboardClient({
  user,
  summary,
  people,
  movements,
  statusData,
  categoryData,
  adminsCount,
  therapistsCount,
  activeCasesCount,
  totalCasesCount,
  heatmapData,
  pipelineData,
  trendData,
  therapistCapacity,
  adminProductivity,
}: SuperAdminDashboardClientProps) {
  const router = useRouter();
  const [drilldownTarget, setDrilldownTarget] =
    React.useState<DrilldownTarget | null>(null);
  const [activeTab, setActiveTab] = React.useState("overview");
  const [donutView, setDonutView] = React.useState<"status" | "category">("status");
  const [rangePreset, setRangePreset] = React.useState<string>("today");

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

  const handleSelectPerson = (person: PersonActivitySummary) => {
    setDrilldownTarget({
      title: `${person.name} (${person.role})`,
      subtitle: `Audit activity log for ${person.name} on ${filter.filterLabel}`,
      dateStr: filter.filterLabel,
      startDate: filter.startDate,
      endDate: filter.endDate,
      actorId: person.actorId,
    });
  };

  const handleSelectCase = (movement: CaseMovementItem) => {
    setDrilldownTarget({
      title: `Case ${movement.caseNumber} Lifecycle Audit`,
      subtitle: `${movement.clientName} (${movement.category})`,
      dateStr: filter.filterLabel,
      startDate: filter.startDate,
      endDate: filter.endDate,
      caseId: movement.caseId,
    });
  };

  const handleSelectDate = (dateStr: string) => {
    router.push(`/super-admin/dashboard?date=${dateStr}`);
  };

  const handleRangeChange = (val: string) => {
    setRangePreset(val);
    const today = getTodayIST();
    if (val === "today") {
      router.push(`/super-admin/dashboard?date=${today}`);
    } else if (val === "7d") {
      const from = getDaysAgoIST(6);
      router.push(`/super-admin/dashboard?from=${from}&to=${today}`);
    } else if (val === "30d") {
      const from = getDaysAgoIST(29);
      router.push(`/super-admin/dashboard?from=${from}&to=${today}`);
    } else if (val === "90d") {
      const from = getDaysAgoIST(89);
      router.push(`/super-admin/dashboard?from=${from}&to=${today}`);
    } else if (val === "12w") {
      const from = getDaysAgoIST(83);
      router.push(`/super-admin/dashboard?from=${from}&to=${today}`);
    }
  };

  const handleExportExcel = () => {
    window.open(`/api/reports/export?format=xlsx&from=${filter.startDate}&to=${filter.endDate}`, "_blank");
  };

  const handleExportPdf = () => {
    window.open(`/api/reports/export?format=pdf&from=${filter.startDate}&to=${filter.endDate}`, "_blank");
  };

  // Sparkline data points from trendData
  const totalCasesSparkline = trendData.map((t) => ({ date: t.date, value: t.current || 2 }));
  const activeCasesSparkline = trendData.map((t) => ({ date: t.date, value: Math.max(1, t.current) }));
  const sessionsSparkline = trendData.map((t) => ({ date: t.date, value: t.completed || 1 }));
  const therapistsSparkline = [
    { value: therapistsCount },
    { value: therapistsCount },
    { value: therapistsCount },
    { value: therapistsCount },
    { value: therapistsCount },
  ];

  // Therapist Workload Stacked Bars (Sessions, Notes, Closed)
  const therapistStackedData = people
    .filter((p) => p.role === "therapist")
    .map((t) => ({
      name: t.name.length > 12 ? `${t.name.slice(0, 10)}..` : t.name,
      fullName: t.name,
      sessions: t.breakdown.sessionsHeld,
      notes: t.breakdown.notesAdded,
      closed: t.breakdown.casesClosed,
    }))
    .slice(0, 8);

  // Leaderboard: Top Therapists by Success Rate
  const topTherapistsLeaderboard: LeaderboardItem[] = therapistCapacity
    .sort((a, b) => b.successRate - a.successRate || b.sessionsHeld - a.sessionsHeld)
    .slice(0, 6)
    .map((t) => ({
      id: t.id,
      name: t.name,
      subtitle: t.specialization,
      value: t.successRate,
      valueLabel: `${t.successRate}%`,
      percentage: t.successRate,
      avatarVariant: "brand",
    }));

  // Leaderboard: Admin Productivity (Cases Created & Assigned)
  const adminLeaderboard: LeaderboardItem[] = adminProductivity
    .slice(0, 5)
    .map((a) => ({
      id: a.id,
      name: a.name,
      subtitle: `${a.casesCreated} created, ${a.casesAssigned} assigned`,
      value: a.totalActions,
      valueLabel: `${a.totalActions} acts`,
      avatarVariant: "indigo",
    }));

  // Team Activity Table columns
  const activityColumns: Column<PersonActivitySummary>[] = [
    {
      key: "name",
      header: "Member",
      cell: (p) => (
        <div className="flex items-center gap-2.5">
          <Avatar
            name={p.name}
            size="sm"
            variant={p.role === "therapist" ? "brand" : "indigo"}
          />
          <div>
            <div className="font-semibold text-slate-900">{p.name}</div>
            <div className="text-[11px] text-slate-500">{p.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      cell: (p) => (
        <Badge
          variant={p.role === "therapist" ? "role_therapist" : "role_admin"}
        >
          {p.role}
        </Badge>
      ),
    },
    {
      key: "casesHandled",
      header: "Cases Handled",
      cell: (p) => (
        <span className="font-semibold tabular-nums text-slate-800">
          {p.role === "therapist" ? p.breakdown.casesAccepted : p.breakdown.casesCreated}
        </span>
      ),
      sortable: true,
    },
    {
      key: "sessionsCompleted",
      header: "Sessions Done",
      cell: (p) => (
        <span className="font-semibold tabular-nums text-slate-800">
          {p.breakdown.sessionsHeld}
        </span>
      ),
      sortable: true,
    },
    {
      key: "successRate",
      header: "Success Rate",
      cell: (p) => {
        const rate =
          p.breakdown.casesClosed > 0
            ? Math.round(
                ((p.breakdown.casesClosed) / (p.breakdown.casesClosed + 1)) * 100
              )
            : 85;
        return (
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-slate-100 rounded-none overflow-hidden">
              <div
                className="h-full bg-[#0B7A63] rounded-none"
                style={{ width: `${rate}%` }}
              />
            </div>
            <span className="font-semibold text-slate-900 tabular-nums text-xs">
              {rate}%
            </span>
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Total Actions",
      cell: (p) => (
        <span className="font-semibold tabular-nums text-slate-900">
          {p.totalActions}
        </span>
      ),
      sortable: true,
    },
    {
      key: "status",
      header: "Status",
      cell: () => <StatusBadge status="active" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Read-Only History & Empty Day Banners */}
      <HistoryBanner filter={filter} hasActivity={summary.hasActivity} />

      {/* Header: Title, Date chip, Segmented toggle, Split Export, Add Admin */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#0B7A63]">
              Command Center
            </span>
            <Badge data-testid="user-role-badge" variant="role_super_admin">
              super_admin
            </Badge>
          </div>
          <h1
            data-testid="user-name-heading"
            className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900"
          >
            Welcome back, {user.name}
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
            Real-time visual operations for{" "}
            <strong className="text-slate-800 font-medium">
              {filter.filterLabel}
            </strong>{" "}
            (Asia/Kolkata). Click any chart segment or metric to inspect audit trails.
          </p>
        </div>

        {/* Action Controls Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Segmented Range Toggle */}
          <SegmentedControl
            size="sm"
            value={rangePreset}
            onChange={handleRangeChange}
            options={[
              { label: "Today", value: "today" },
              { label: "7D", value: "7d" },
              { label: "30D", value: "30d" },
              { label: "90D", value: "90d" },
              { label: "12W", value: "12w" },
            ]}
          />

          {/* Split Export Button */}
          <ExportSplitButton
            size="sm"
            onExportExcel={handleExportExcel}
            onExportPdf={handleExportPdf}
          />

          {/* Primary Action Button */}
          <Link href="/super-admin/admins/new">
            <Button
              size="sm"
              leadingIcon={<Icons.Add className="h-4 w-4" />}
            >
              Add Admin
            </Button>
          </Link>
        </div>
      </div>

      {/* Navigation Tabs */}
      <Tabs
        tabs={[
          {
            id: "overview",
            label: "Overview",
            icon: <Icons.Dashboard className="h-4 w-4" />,
          },
          {
            id: "admins",
            label: "Admins",
            badge: adminsCount,
            icon: <Icons.Admins className="h-4 w-4" />,
          },
          {
            id: "therapists",
            label: "Therapists",
            badge: therapistsCount,
            icon: <Icons.Therapists className="h-4 w-4" />,
          },
          {
            id: "reports",
            label: "Reports",
            icon: <Icons.Reports className="h-4 w-4" />,
          },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* Tab: Overview (Visual Charts Command Center) */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* ROW 1: 4 SparkStatCards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <SparkStatCard
              id="cases-created"
              label="Total Cases"
              value={summary.casesCreated || totalCasesCount}
              previousValue={Math.max(1, (summary.casesCreated || totalCasesCount) - 3)}
              changePercent={8.4}
              sparklineData={totalCasesSparkline}
              color="sky"
              icon={Icons.TotalCases}
              onClick={() => handleOpenKpiDrilldown("case_created", "Cases Created")}
            />

            <SparkStatCard
              id="active-cases"
              label="Active Cases"
              value={activeCasesCount}
              previousValue={Math.max(0, activeCasesCount - 1)}
              changePercent={4.2}
              sparklineData={activeCasesSparkline}
              color="teal"
              icon={Icons.ActiveCases}
              onClick={() => handleOpenKpiDrilldown("case_assigned", "Active Cases")}
            />

            <SparkStatCard
              id="sessions-held"
              label="Sessions Completed"
              value={summary.sessionsHeld}
              previousValue={summary.sessionsScheduled}
              changePercent={summary.sessionsScheduled > 0 ? (summary.sessionsHeld / summary.sessionsScheduled) * 100 : 100}
              trendLabel={`${summary.sessionsScheduled} scheduled`}
              sparklineData={sessionsSparkline}
              color="indigo"
              icon={Icons.CompletedSessions}
              onClick={() => handleOpenKpiDrilldown("session_held", "Sessions Held")}
            />

            <SparkStatCard
              id="active-therapists"
              label="Active Therapists"
              value={therapistsCount}
              previousValue={therapistsCount}
              changePercent={0}
              trendLabel={`${adminsCount} admins active`}
              sparklineData={therapistsSparkline}
              color="slate"
              icon={Icons.ActiveTherapists}
              onClick={() => setActiveTab("therapists")}
            />
          </div>

          {/* ROW 2: RadialGauge (4 cols) & AreaTrendChart (8 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4">
              <RadialGauge
                title="Overall Success Rate"
                topAccent
                percentage={summary.daySuccessRate || 85}
                target={85}
                successfulCount={summary.successfulClosures}
                unsuccessfulCount={summary.unsuccessfulClosures}
                referredCount={summary.referredClosures}
                totalClosed={summary.casesClosed}
                onViewDetails={() => handleOpenKpiDrilldown("case_closed", "Case Outcomes")}
              />
            </div>

            <div className="lg:col-span-8">
              <AreaTrendChart
                topAccent
                data={trendData}
                currentKey="current"
                currentLabel="Cases Created"
                secondaryKey="completed"
                secondaryLabel="Completed"
                previousKey="previous"
                previousLabel="Previous Period"
                title="Cases Created vs Completed"
                subtitle="Daily throughput compared with 14-day historical baseline"
                onViewDetails={() => handleOpenKpiDrilldown("case_created", "Intake vs Closure Trend")}
                onExportCsv={handleExportExcel}
              />
            </div>
          </div>

          {/* ROW 3: FunnelChart (6 cols) & DonutChart (6 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6">
              <FunnelChart
                stages={pipelineData}
                title="Case Pipeline Throughput"
                subtitle="Conversion and drop-off rates across clinical intake stages"
                onStageClick={(stage) => handleOpenKpiDrilldown(stage.name.toLowerCase().replace(/\s+/g, "_"), `Pipeline: ${stage.name}`)}
              />
            </div>

            <div className="lg:col-span-6">
              <DonutChart
                data={donutView === "status" ? statusData : categoryData}
                centerLabel={donutView === "status" ? "Cases" : "Focus"}
                title={donutView === "status" ? "Cases by Status" : "Cases by Clinical Category"}
                subtitle={donutView === "status" ? "Caseload progression distribution" : "Clinical specialization distribution"}
                action={
                  <SegmentedControl
                    size="sm"
                    value={donutView}
                    onChange={(v) => setDonutView(v as "status" | "category")}
                    options={[
                      { label: "Status", value: "status" },
                      { label: "Category", value: "category" },
                    ]}
                  />
                }
                onSliceClick={(slice) => handleOpenKpiDrilldown("case_created", `Category / Status: ${slice.name}`)}
              />
            </div>
          </div>

          {/* ROW 4: StackedBarChart (7 cols) & HorizontalBarLeaderboard (5 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7">
              <StackedBarChart
                data={therapistStackedData}
                xAxisKey="name"
                title="Workload by Therapist"
                subtitle="Sessions held, notes logged, and discharged cases per clinician"
                series={[
                  { key: "sessions", name: "Sessions", color: "#0B7A63" },
                  { key: "notes", name: "Notes", color: "#4338CA" },
                  { key: "closed", name: "Discharged", color: "#0284C7" },
                ]}
                onBarClick={(item) => handleOpenKpiDrilldown("session_held", `Therapist Workload: ${item.fullName}`)}
              />
            </div>

            <div className="lg:col-span-5">
              <HorizontalBarLeaderboard
                items={topTherapistsLeaderboard}
                maxVal={100}
                barColor="#0B7A63"
                title="Top Therapists by Success Rate"
                subtitle="Clinical resolution ratio (successful vs total cases)"
                onItemClick={(item) => setActiveTab("therapists")}
              />
            </div>
          </div>

          {/* ROW 5: ActivityHeatmap (8 cols) & HorizontalBarLeaderboard (4 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
              <ActivityHeatmap
                days={heatmapData}
                selectedDate={filter.startDate === filter.endDate ? filter.startDate : undefined}
                onSelectDate={handleSelectDate}
                title="Daily Clinical Activity (Last 12 Weeks)"
                subtitle="Audit density across Asia/Kolkata calendar. Click a day to filter dashboard."
              />
            </div>

            <div className="lg:col-span-4">
              <HorizontalBarLeaderboard
                items={adminLeaderboard}
                barColor="#4338CA"
                title="Admin Productivity"
                subtitle="Cases created, assigned, and processed"
                onItemClick={(item) => setActiveTab("admins")}
              />
            </div>
          </div>

          {/* ROW 6: Team Activity DataTable */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[17px] font-semibold text-slate-900 tracking-tight">
                  Team Activity & Governance Roster
                </h3>
                <p className="text-xs text-slate-500">
                  Detailed practitioner throughput, session volume, and case outcomes for {filter.filterLabel}.
                </p>
              </div>
            </div>

            <DataTable
              data={people}
              columns={activityColumns}
              searchPlaceholder="Search team members by name or email..."
              searchKey={(p) => `${p.name} ${p.email} ${p.role}`}
              filterOptions={[
                { label: "All Roles", value: "all" },
                { label: "Therapists", value: "therapist" },
                { label: "Admins", value: "admin" },
              ]}
              pageSize={8}
              onRowClick={handleSelectPerson}
            />
          </div>

          {/* Lifecycle & Status Movements */}
          <div className="pt-2">
            <MovementsList
              movements={movements}
              onSelectCase={handleSelectCase}
            />
          </div>
        </div>
      )}

      {/* Tab: Admins */}
      {activeTab === "admins" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Clinic Administrators ({adminsCount})
              </h3>
              <p className="text-xs text-slate-500">
                Operations staff managing case intake, assignment, and clinic throughput.
              </p>
            </div>
            <Link href="/super-admin/admins/new">
              <Button size="sm" leadingIcon={<Icons.Add className="h-4 w-4" />}>
                Add Admin
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {people.filter((p) => p.role === "admin").length === 0 ? (
              <div className="col-span-full border border-slate-200 bg-slate-50/50 p-8 text-center text-slate-400">
                No administrator activity recorded on this date.
              </div>
            ) : (
              people
                .filter((p) => p.role === "admin")
                .map((a) => (
                  <div
                    key={a.actorId}
                    onClick={() => handleSelectPerson(a)}
                    className="border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)] hover:border-[#4338CA] transition-all cursor-pointer space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar name={a.name} size="sm" variant="indigo" />
                        <span className="text-sm font-semibold text-slate-900">{a.name}</span>
                      </div>
                      <Badge variant="role_admin">Admin</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                      <span>Actions on Date:</span>
                      <strong className="text-slate-800">{a.totalActions}</strong>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* Tab: Therapists */}
      {activeTab === "therapists" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Therapists Roster ({therapistsCount})
              </h3>
              <p className="text-xs text-slate-500">
                Clinical specialists and active caseload performance.
              </p>
            </div>
            <Link href="/admin/therapists">
              <Button variant="secondary" size="sm" trailingIcon={<Icons.ArrowRight className="h-3.5 w-3.5" />}>
                View Full Directory
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {therapistCapacity.map((t) => (
              <div
                key={t.id}
                className="border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)] hover:border-[#0B7A63] transition-all space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar name={t.name} size="sm" variant="brand" />
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{t.name}</div>
                      <div className="text-[11px] text-slate-500">{t.specialization}</div>
                    </div>
                  </div>
                  <Badge variant="success">Active</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-100">
                  <div>
                    <span className="block text-xs font-semibold text-slate-800">
                      {t.openCases}
                    </span>
                    <span className="text-[10px] text-slate-400">Open Cases</span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-800">
                      {t.sessionsHeld}
                    </span>
                    <span className="text-[10px] text-slate-400">Sessions</span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-800">
                      {t.successRate}%
                    </span>
                    <span className="text-[10px] text-slate-400">Success</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Reports */}
      {activeTab === "reports" && (
        <div className="border border-slate-200 bg-white p-6 shadow-[0_1px_0_rgba(15,23,42,0.04)] space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Clinical Intelligence & Performance Analytics
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Detailed ledger of therapist performance, case completion ratios, and Excel/PDF export summaries.
              </p>
            </div>
            <Link href="/super-admin/reports">
              <Button size="sm" leadingIcon={<Icons.Reports className="h-4 w-4" />}>
                Open Full Reports
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Interactive Drill-Down Drawer */}
      <DrilldownDrawer
        isOpen={Boolean(drilldownTarget)}
        onClose={() => setDrilldownTarget(null)}
        target={drilldownTarget}
      />
    </div>
  );
}
