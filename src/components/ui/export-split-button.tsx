"use client";

import * as React from "react";
import { Button } from "./button";
import { Icons } from "./icons";
import { cn } from "@/lib/utils";

interface ExportSplitButtonProps {
  onExportExcel?: () => void;
  onExportPdf?: () => void;
  onExportCsv?: () => void;
  size?: "sm" | "md";
  className?: string;
  isExporting?: boolean;
}

export function ExportSplitButton({
  onExportExcel,
  onExportPdf,
  onExportCsv,
  size = "md",
  className,
  isExporting = false,
}: ExportSplitButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handlePrimaryExport = () => {
    if (onExportExcel) {
      onExportExcel();
    } else if (onExportCsv) {
      onExportCsv();
    } else if (onExportPdf) {
      onExportPdf();
    }
  };

  return (
    <div ref={containerRef} className={cn("relative inline-flex shadow-[0_1px_0_rgba(15,23,42,0.04)]", className)}>
      {/* Primary Export Action */}
      <Button
        type="button"
        variant="secondary"
        size={size}
        isLoading={isExporting}
        leadingIcon={<Icons.Download className="h-4 w-4" />}
        onClick={handlePrimaryExport}
        className="rounded-none border-r-0 focus-visible:z-10"
      >
        Export
      </Button>

      {/* Dropdown Chevron Trigger */}
      <button
        type="button"
        aria-label="Export options"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "inline-flex items-center justify-center border border-slate-300 bg-white text-slate-700 hover:border-[#0B7A63] hover:text-[#0B7A63] active:bg-slate-50 transition-colors rounded-none px-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A63]",
          size === "sm" ? "h-9 w-8" : "h-11 w-9"
        )}
      >
        <Icons.CaretDown className={cn("h-3.5 w-3.5 transition-transform duration-150", isOpen && "rotate-180")} />
      </button>

      {/* Sharp Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-50 min-w-[170px] border border-slate-200 bg-white p-1 shadow-[0_4px_12px_rgba(15,23,42,0.08)] rounded-none animate-in fade-in-50 zoom-in-95 duration-150"
        >
          <div className="px-2.5 py-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Format options
          </div>
          {onExportExcel && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onExportExcel();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-none transition-colors text-left"
            >
              <Icons.FileExcel className="h-4 w-4 text-emerald-600" />
              <span>Export as Excel (.xlsx)</span>
            </button>
          )}
          {onExportPdf && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onExportPdf();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-none transition-colors text-left"
            >
              <Icons.FilePdf className="h-4 w-4 text-rose-600" />
              <span>Export as PDF (.pdf)</span>
            </button>
          )}
          {onExportCsv && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onExportCsv();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-none transition-colors text-left"
            >
              <Icons.FileText className="h-4 w-4 text-sky-600" />
              <span>Export as CSV (.csv)</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
