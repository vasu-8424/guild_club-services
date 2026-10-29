"use client";

import * as React from "react";
import { Download, FileText, ChevronDown, RefreshCw, AlertCircle } from "lucide-react";

interface BranchReportButtonProps {
  branchId?: string | null;
  className?: string;
}

export function BranchReportButton({ branchId, className = "" }: BranchReportButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [showLongWaitNotice, setShowLongWaitNotice] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleDownload = async (format: "csv" | "pdf") => {
    setIsOpen(false);
    setIsDownloading(true);
    setShowLongWaitNotice(false);

    // If generation takes more than 15 seconds, show the friendly notification
    timerRef.current = setTimeout(() => {
      setShowLongWaitNotice(true);
    }, 15000);

    try {
      const url = `/api/admin/reports/branch-patients?format=${format}${branchId ? `&branchId=${branchId}` : ""}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error("Report download failed");
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("content-disposition");
      let filename = `branch-patient-report.${format}`;
      if (contentDisposition && contentDisposition.includes("filename=")) {
        const matches = /filename="?([^"]+)"?/.exec(contentDisposition);
        if (matches && matches[1]) {
          filename = matches[1];
        }
      }

      // Trigger browser download
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      console.error("Report download error:", e);
      alert("Could not generate report. Please ensure an active branch is selected and try again.");
    } finally {
      if (timerRef.current) clearTimeout(timerRef.current);
      setIsDownloading(false);
      setShowLongWaitNotice(false);
    }
  };

  return (
    <div className={`relative inline-flex items-center ${className}`} ref={dropdownRef}>
      {/* Primary Split Button */}
      <div className="inline-flex rounded-none shadow-xs border border-slate-300 bg-white">
        {/* Main Action: Download CSV */}
        <button
          type="button"
          data-testid="branch-report-download-btn"
          disabled={isDownloading}
          onClick={() => handleDownload("csv")}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-700 hover:bg-slate-50 hover:text-[#0B7A63] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isDownloading ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#0B7A63]" />
          ) : (
            <Download className="h-3.5 w-3.5 text-[#0B7A63]" />
          )}
          <span>{isDownloading ? "Generating..." : "Download Report"}</span>
        </button>

        {/* Dropdown Toggle for Format Selection */}
        <button
          type="button"
          data-testid="branch-report-split-toggle"
          disabled={isDownloading}
          onClick={() => setIsOpen(!isOpen)}
          className="px-1.5 border-l border-slate-300 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
          aria-label="Select report format"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Split Dropdown Menu */}
      {isOpen && (
        <div
          data-testid="branch-report-dropdown-menu"
          className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-300 rounded-none shadow-md z-50 py-1"
        >
          <button
            type="button"
            data-testid="branch-report-csv-btn"
            onClick={() => handleDownload("csv")}
            className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-[#0B7A63] flex items-center gap-2 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-slate-400" />
            <span>Excel / CSV Roster</span>
          </button>
          <button
            type="button"
            data-testid="branch-report-pdf-btn"
            onClick={() => handleDownload("pdf")}
            className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-[#0B7A63] flex items-center gap-2 cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5 text-slate-400" />
            <span>Printable PDF (A4)</span>
          </button>
        </div>
      )}

      {/* 15-second Long Generation Notice */}
      {showLongWaitNotice && (
        <div
          data-testid="branch-report-preparing-notice"
          className="fixed bottom-4 right-4 max-w-sm bg-slate-900 text-white p-3.5 rounded-none shadow-lg text-xs z-50 flex items-start gap-2.5 border-l-4 border-[#0B7A63]"
        >
          <RefreshCw className="h-4 w-4 animate-spin text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Preparing your report</p>
            <p className="text-slate-300 mt-0.5">We will start the download when it is ready.</p>
          </div>
        </div>
      )}
    </div>
  );
}

