"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Icons } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { exportReportsToExcel, exportReportsToPdf } from "@/lib/report-exports";
import type { SuperAdminReportsData } from "@/lib/dashboard";

interface ReportsClientProps {
  data: SuperAdminReportsData;
  dateRangeLabel: string;
  startDate?: string;
  endDate?: string;
  branchName?: string;
}

export function ReportsClient({
  data,
  dateRangeLabel,
  startDate,
  endDate,
  branchName = "Clinic Branch",
}: ReportsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isExportingExcel, setIsExportingExcel] = React.useState(false);
  const [isExportingPdf, setIsExportingPdf] = React.useState(false);

  const [fromInput, setFromInput] = React.useState(startDate || "");
  const [toInput, setToInput] = React.useState(endDate || "");

  React.useEffect(() => {
    if (startDate) setFromInput(startDate);
    if (endDate) setToInput(endDate);
  }, [startDate, endDate]);

  const handleApplyRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromInput || !toInput) return;
    const sp = new URLSearchParams(searchParams ? searchParams.toString() : "");
    sp.set("from", fromInput);
    sp.set("to", toInput);
    router.push(`${pathname}?${sp.toString()}`);
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

  return (
    <div className="space-y-6 max-w-4xl">
      {/* 1. Header with plain title and one line of help text */}
      <div className="rounded-none border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#0B7A63]">
            Super Admin Portal
          </span>
          <span className="text-slate-300">&bull;</span>
          <span className="text-xs font-semibold text-slate-700">{branchName}</span>
        </div>
        <h1 data-testid="reports-title" className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Reports
        </h1>
        <p data-testid="reports-help-text" className="text-xs sm:text-sm text-slate-500 mt-1">
          Export clinical records and operations reports for {branchName}.
        </p>
      </div>

      {/* 2. Date Range Filter Form (Native From and To date fields) */}
      <div className="rounded-none border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
          Date Range
        </h2>
        <form onSubmit={handleApplyRange} className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 space-y-1.5">
            <label
              htmlFor="report-from"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600"
            >
              From
            </label>
            <input
              id="report-from"
              type="date"
              data-testid="report-from-date"
              value={fromInput}
              onChange={(e) => setFromInput(e.target.value)}
              className="w-full min-h-[48px] rounded-none border border-slate-300 bg-white px-3.5 py-2.5 text-base font-medium text-slate-900 focus:outline-none focus:border-[#0B7A63]"
              required
            />
          </div>

          <div className="flex-1 space-y-1.5">
            <label
              htmlFor="report-to"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600"
            >
              To
            </label>
            <input
              id="report-to"
              type="date"
              data-testid="report-to-date"
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              className="w-full min-h-[48px] rounded-none border border-slate-300 bg-white px-3.5 py-2.5 text-base font-medium text-slate-900 focus:outline-none focus:border-[#0B7A63]"
              required
            />
          </div>

          <Button
            type="submit"
            variant="secondary"
            className="w-full sm:w-auto min-h-[48px] px-6 uppercase tracking-wider text-xs font-bold rounded-none"
          >
            Apply Range
          </Button>
        </form>
      </div>

      {/* 3. Export Section: Export to Excel and Export to PDF */}
      <div className="rounded-none border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
            Export Options
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Scope: <strong className="text-slate-700">{branchName}</strong> &bull; Period:{" "}
            <strong className="text-slate-700">{dateRangeLabel}</strong>
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <Button
            type="button"
            variant="secondary"
            data-testid="export-excel-button"
            className="w-full min-h-[48px] rounded-none text-sm font-semibold"
            onClick={handleExportExcel}
            isLoading={isExportingExcel}
            leadingIcon={<Icons.FileExcel className="h-4 w-4 text-emerald-600" />}
          >
            Export to Excel (.xlsx)
          </Button>

          <Button
            type="button"
            data-testid="export-pdf-button"
            className="w-full min-h-[48px] rounded-none text-sm font-semibold"
            onClick={handleExportPdf}
            isLoading={isExportingPdf}
            leadingIcon={<Icons.FilePdf className="h-4 w-4" />}
          >
            Export to PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
