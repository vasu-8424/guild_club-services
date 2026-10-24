"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Icons } from "@/components/ui/icons";
import {
  getTodayIST,
  getYesterdayIST,
  getDaysAgoIST,
  parseDateFilter,
} from "@/lib/date-utils";
import { Button } from "@/components/ui/button";

export function DateSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Parse current URL params
  const dateParam = searchParams.get("date") || undefined;
  const fromParam = searchParams.get("from") || undefined;
  const toParam = searchParams.get("to") || undefined;

  const filter = parseDateFilter({
    date: dateParam,
    from: fromParam,
    to: toParam,
  });

  // State for custom inputs inside popup
  const [customSingleDate, setCustomSingleDate] = React.useState(
    filter.startDate || getTodayIST()
  );
  const [customFrom, setCustomFrom] = React.useState(
    filter.startDate || getTodayIST()
  );
  const [customTo, setCustomTo] = React.useState(
    filter.endDate || getTodayIST()
  );
  const [activeTab, setActiveTab] = React.useState<"presets" | "single" | "range">(
    filter.isRange ? "range" : filter.presetKey === "custom_date" ? "single" : "presets"
  );

  // Close popup on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const applyParams = (params: Record<string, string | null>) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    for (const [key, val] of Object.entries(params)) {
      if (val === null) {
        current.delete(key);
      } else {
        current.set(key, val);
      }
    }
    setIsOpen(false);
    const qs = current.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  };

  const handleSelectToday = () => {
    applyParams({ date: null, from: null, to: null }); // default is today
  };

  const handleSelectYesterday = () => {
    applyParams({ date: getYesterdayIST(), from: null, to: null });
  };

  const handleSelectLast7 = () => {
    applyParams({
      from: getDaysAgoIST(6),
      to: getTodayIST(),
      date: null,
    });
  };

  const handleApplySingleDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSingleDate) return;
    if (customSingleDate === getTodayIST()) {
      handleSelectToday();
    } else {
      applyParams({ date: customSingleDate, from: null, to: null });
    }
  };

  const handleApplyRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFrom || !customTo) return;
    if (customFrom > customTo) {
      applyParams({ from: customTo, to: customFrom, date: null });
    } else {
      applyParams({ from: customFrom, to: customTo, date: null });
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button: Sharp 0px corners, 1px border */}
      <button
        type="button"
        data-testid="dashboard-date-selector"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-none border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-[0_1px_0_rgba(15,23,42,0.04)] hover:bg-slate-50 hover:border-[#0B7A63] focus:outline-none focus:ring-1 focus:ring-[#0B7A63] transition-colors"
        aria-expanded={isOpen}
      >
        <Icons.Calendar className="h-4 w-4 text-[#0B7A63] shrink-0" />
        <span className="font-semibold text-slate-900 max-w-[170px] sm:max-w-xs truncate">
          {filter.filterLabel}
        </span>
        {filter.isPast && (
          <span className="inline-flex items-center rounded-[2px] bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800 uppercase tracking-wider">
            History
          </span>
        )}
        <Icons.CaretDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {/* Dropdown Menu: Sharp 0px, 1px border */}
      {isOpen && (
        <div
          data-testid="date-selector-dropdown"
          className="absolute right-0 z-50 mt-2 w-80 rounded-none border border-slate-300 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.12)] animate-in fade-in-0 zoom-in-95 duration-100"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase tracking-wider">
              <Icons.Clock className="h-3.5 w-3.5 text-[#0B7A63]" />
              <span>Timeframe (Asia/Kolkata)</span>
            </div>
            <button
              type="button"
              onClick={handleSelectToday}
              className="text-[11px] font-semibold text-[#0B7A63] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Icons.Undo className="h-3 w-3" />
              Reset Today
            </button>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-0.5 mb-3 text-xs border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab("presets")}
              className={`rounded-none py-1 text-xs font-semibold transition-colors ${
                activeTab === "presets"
                  ? "bg-[#0B7A63] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Presets
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("single")}
              className={`rounded-none py-1 text-xs font-semibold transition-colors ${
                activeTab === "single"
                  ? "bg-[#0B7A63] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Single Date
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("range")}
              className={`rounded-none py-1 text-xs font-semibold transition-colors ${
                activeTab === "range"
                  ? "bg-[#0B7A63] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Custom Range
            </button>
          </div>

          {/* Tab 1: Presets */}
          {activeTab === "presets" && (
            <div className="space-y-1.5">
              <button
                type="button"
                data-testid="preset-today-button"
                onClick={handleSelectToday}
                className={`w-full flex items-center justify-between rounded-none px-3 py-2 text-xs text-left transition-colors border ${
                  filter.isToday
                    ? "bg-[#0B7A63]/10 text-[#0B7A63] font-bold border-[#0B7A63]/30"
                    : "border-slate-100 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <span>Today (Live)</span>
                {filter.isToday && <Icons.Check className="h-3.5 w-3.5 text-[#0B7A63]" />}
              </button>

              <button
                type="button"
                data-testid="preset-yesterday-button"
                onClick={handleSelectYesterday}
                className={`w-full flex items-center justify-between rounded-none px-3 py-2 text-xs text-left transition-colors border ${
                  filter.presetKey === "yesterday"
                    ? "bg-[#0B7A63]/10 text-[#0B7A63] font-bold border-[#0B7A63]/30"
                    : "border-slate-100 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <span>Yesterday</span>
                {filter.presetKey === "yesterday" && (
                  <Icons.Check className="h-3.5 w-3.5 text-[#0B7A63]" />
                )}
              </button>

              <button
                type="button"
                data-testid="preset-last7-button"
                onClick={handleSelectLast7}
                className={`w-full flex items-center justify-between rounded-none px-3 py-2 text-xs text-left transition-colors border ${
                  filter.presetKey === "last7"
                    ? "bg-[#0B7A63]/10 text-[#0B7A63] font-bold border-[#0B7A63]/30"
                    : "border-slate-100 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <span>Last 7 Days</span>
                {filter.presetKey === "last7" && (
                  <Icons.Check className="h-3.5 w-3.5 text-[#0B7A63]" />
                )}
              </button>
            </div>
          )}

          {/* Tab 2: Single Date */}
          {activeTab === "single" && (
            <form onSubmit={handleApplySingleDate} className="space-y-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Select Calendar Date
                </label>
                <input
                  type="date"
                  value={customSingleDate}
                  max={getTodayIST()}
                  onChange={(e) => setCustomSingleDate(e.target.value)}
                  className="w-full rounded-none border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#0B7A63] focus:outline-none focus:ring-1 focus:ring-[#0B7A63]"
                />
              </div>

              <Button
                type="submit"
                size="sm"
                className="w-full"
                data-testid="apply-single-date-button"
              >
                Apply Date
              </Button>
            </form>
          )}

          {/* Tab 3: Custom Range */}
          {activeTab === "range" && (
            <form onSubmit={handleApplyRange} className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    From
                  </label>
                  <input
                    type="date"
                    value={customFrom}
                    max={getTodayIST()}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-full rounded-none border border-slate-300 px-2.5 py-2 text-xs font-semibold text-slate-800 focus:border-[#0B7A63] focus:outline-none focus:ring-1 focus:ring-[#0B7A63]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    To
                  </label>
                  <input
                    type="date"
                    value={customTo}
                    max={getTodayIST()}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="w-full rounded-none border border-slate-300 px-2.5 py-2 text-xs font-semibold text-slate-800 focus:border-[#0B7A63] focus:outline-none focus:ring-1 focus:ring-[#0B7A63]"
                  />
                </div>
              </div>

              <Button
                type="submit"
                size="sm"
                className="w-full"
                data-testid="apply-range-button"
              >
                Apply Range
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
