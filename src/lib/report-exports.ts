import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { SuperAdminReportsData } from "@/lib/dashboard";

/**
 * Generates and downloads an Excel (.xlsx) analytics report with multiple sheets.
 */
export function exportReportsToExcel(
  data: SuperAdminReportsData,
  dateRangeLabel: string
) {
  const wb = XLSX.utils.book_new();

  // 1. Overview Sheet
  const overviewRows = [
    ["Guild Club Services - Executive Clinical Report"],
    ["Date Range:", dateRangeLabel],
    ["Generated At (IST):", new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })],
    [],
    ["Key Performance Indicator", "Value", "Unit / Context"],
    ["Overall Success Rate", `${data.overallMetrics.overallSuccessRate}%`, "Successful / Total Closures"],
    ["Total Cases Logged", data.overallMetrics.totalCases, "Clinical Inward Intakes"],
    ["Total Cases Discharged", data.overallMetrics.totalClosed, "Completed Trajectories"],
    ["Successful Discharges", data.overallMetrics.successfulClosures, "Goal Met / Treatment Complete"],
    ["Avg Case Resolution Time", `${data.overallMetrics.avgResolutionDays} days`, "Intake to Discharge"],
    ["Avg Therapist Acceptance Time", `${data.overallMetrics.avgAcceptanceHours} hours`, "Assignment to Accepted"],
    ["Reassignment / Decline Rate", `${data.overallMetrics.reassignmentRate}%`, "Declined / Total Assigned"],
    ["Total Sessions Held", data.overallMetrics.totalSessionsHeld, "Face-to-face / Online"],
  ];
  const wsOverview = XLSX.utils.aoa_to_sheet(overviewRows);
  XLSX.utils.book_append_sheet(wb, wsOverview, "Executive Overview");

  // 2. Therapist Performance Sheet
  const therapistRows = [
    [
      "Therapist Name",
      "Specialization",
      "Total Assigned",
      "Accepted",
      "Declined",
      "Sessions Held",
      "Cases Closed",
      "Successful Closures",
      "Success Rate (%)",
      "Avg Resolution (Days)",
    ],
    ...data.therapistPerformance.map((t) => [
      t.therapistName,
      t.specialization,
      t.totalAssigned,
      t.acceptedCount,
      t.declinedCount,
      t.sessionsHeld,
      t.casesClosed,
      t.successfulCount,
      `${t.successRate}%`,
      t.avgResolutionDays,
    ]),
  ];
  const wsTherapists = XLSX.utils.aoa_to_sheet(therapistRows);
  XLSX.utils.book_append_sheet(wb, wsTherapists, "Therapist Performance");

  // 3. Monthly Trends Sheet
  const monthlyRows = [
    [
      "Month",
      "Cases Created",
      "Cases Closed",
      "Successful Closures",
      "Sessions Held",
      "Success Rate (%)",
    ],
    ...data.monthlyTrends.map((m) => [
      m.monthLabel,
      m.casesCreated,
      m.casesClosed,
      m.successfulClosed,
      m.sessionsHeld,
      `${m.successRate}%`,
    ]),
  ];
  const wsMonthly = XLSX.utils.aoa_to_sheet(monthlyRows);
  XLSX.utils.book_append_sheet(wb, wsMonthly, "Monthly Trends");

  // 4. Clinical Categories Sheet
  const catRows = [
    ["Clinical Category", "Case Count", "Share (%)"],
    ...data.categoryBreakdown.map((c) => [c.category, c.count, `${c.percentage}%`]),
  ];
  const wsCategories = XLSX.utils.aoa_to_sheet(catRows);
  XLSX.utils.book_append_sheet(wb, wsCategories, "Categories");

  // Download File
  XLSX.writeFile(wb, `guild_club_services_analytics_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Generates and downloads a branded PDF analytics report.
 */
export function exportReportsToPdf(
  data: SuperAdminReportsData,
  dateRangeLabel: string
) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Header branding
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text("GUILD CLUB SERVICES", 14, 18);

  doc.setFontSize(11);
  doc.setTextColor(16, 185, 129); // emerald-600
  doc.text("Therapy Case Management • Executive Clinical Analytics Report", 14, 24);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(
    `Timeframe: ${dateRangeLabel} • Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} (Asia/Kolkata)`,
    14,
    30
  );

  doc.setDrawColor(226, 232, 240); // slate-200
  doc.line(14, 33, 196, 33);

  // Overview Table
  autoTable(doc, {
    startY: 37,
    head: [["Executive KPI", "Value", "Key Performance Description"]],
    body: [
      ["Overall Success Rate", `${data.overallMetrics.overallSuccessRate}%`, "Successful discharges / all completed cases"],
      ["Total Cases Registered", String(data.overallMetrics.totalCases), "Clinical intake volume during timeframe"],
      ["Total Cases Discharged", String(data.overallMetrics.totalClosed), "Cases closed with outcome documentation"],
      ["Successful Outcomes", String(data.overallMetrics.successfulClosures), "Goal met / positive therapeutic discharge"],
      ["Avg Case Resolution Time", `${data.overallMetrics.avgResolutionDays} days`, "Average duration from intake to discharge"],
      ["Avg Acceptance Time", `${data.overallMetrics.avgAcceptanceHours} hours`, "Time taken by therapist to accept assigned case"],
      ["Reassignment / Decline Rate", `${data.overallMetrics.reassignmentRate}%`, "Cases declined and routed for reassignment"],
      ["Total Sessions Held", String(data.overallMetrics.totalSessionsHeld), "Appointments marked as held and attended"],
    ],
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42], fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 8.5 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 50 },
      1: { fontStyle: "bold", cellWidth: 30 },
      2: { cellWidth: 102 },
    },
  });

  // Therapist Performance Table
  const lastY1 = (doc as any).lastAutoTable?.finalY || 100;
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("Therapist Caseload & Clinical Performance", 14, lastY1 + 10);

  const therapistTableData = data.therapistPerformance.map((t) => [
    t.therapistName,
    t.specialization,
    String(t.totalAssigned),
    String(t.sessionsHeld),
    String(t.casesClosed),
    `${t.successRate}%`,
    `${t.avgResolutionDays}d`,
  ]);

  autoTable(doc, {
    startY: lastY1 + 14,
    head: [["Therapist", "Specialization", "Assigned", "Sessions", "Closed", "Success Rate", "Avg Res."]],
    body: therapistTableData.length > 0 ? therapistTableData : [["No therapist activity recorded", "-", "-", "-", "-", "-", "-"]],
    theme: "grid",
    headStyles: { fillColor: [5, 150, 105], fontSize: 8.5 }, // emerald-600
    bodyStyles: { fontSize: 8 },
  });

  // Monthly Trends Table
  const lastY2 = (doc as any).lastAutoTable?.finalY || 180;
  if (lastY2 < 240) {
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text("Monthly Caseload Trends (Last 6 Months)", 14, lastY2 + 10);

    const monthlyTableData = data.monthlyTrends.map((m) => [
      m.monthLabel,
      String(m.casesCreated),
      String(m.casesClosed),
      String(m.successfulClosed),
      String(m.sessionsHeld),
      `${m.successRate}%`,
    ]);

    autoTable(doc, {
      startY: lastY2 + 14,
      head: [["Month", "Intakes Created", "Cases Closed", "Successful", "Sessions Held", "Success Rate"]],
      body: monthlyTableData,
      theme: "striped",
      headStyles: { fillColor: [79, 70, 229], fontSize: 8.5 }, // indigo-600
      bodyStyles: { fontSize: 8 },
    });
  }

  doc.save(`guild_club_services_analytics_${new Date().toISOString().slice(0, 10)}.pdf`);
}
