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
      alert("Start date must be before or equal to End date.");
      return;
    }
    applyParams({ from: customFrom, to: customTo, date: null });
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-testid="date-selector-button"
        onClick={() => setIsOpen(!isOpen)}
        leadingIcon={<Icons.Calendar className="h-4 w-4 text-[#0B7A63]" />}
        trailingIcon={<Icons.CaretDown className="h-3 w-3 text-slate-400" />}
        className="min-h-[44px] h-[44px] px-3 border border-slate-300 bg-white hover:border-[#0B7A63] text-left transition-colors select-none touch-manipulation cursor-pointer"
        aria-expanded={isOpen}
      >
        <span className="font-semibold text-slate-900 text-[14px] max-w-[120px] sm:max-w-xs truncate">
          {filter.filterLabel}
        </span>
        {filter.isPast && (
          <span className="ml-1 inline-flex items-center rounded-none bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 uppercase tracking-wider shrink-0">
            Past
          </span>
        )}
      </Button>

      {/* Date Selection Modal Bottom Sheet on Mobile, Popover on Desktop */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          <div
            data-testid="date-selector-dropdown"
            className="fixed inset-x-0 bottom-0 z-50 w-full max-w-[480px] mx-auto rounded-none border-t-2 border-[#0B7A63] bg-white p-5 shadow-[0_-8px_32px_rgba(15,23,42,0.2)] pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-150 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
              <div className="flex items-center gap-2 text-[14px] font-bold text-slate-900 uppercase tracking-wider">
                <Icons.Clock className="h-4 w-4 text-[#0B7A63]" />
                <span>Select Timeframe (IST)</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <Icons.Close className="h-5 w-5" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 mb-4 text-[13px] border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab("presets")}
                className={`min-h-[44px] rounded-none py-2 text-[13px] font-semibold transition-colors select-none touch-manipulation cursor-pointer ${
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
                className={`min-h-[44px] rounded-none py-2 text-[13px] font-semibold transition-colors select-none touch-manipulation cursor-pointer ${
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
                className={`min-h-[44px] rounded-none py-2 text-[13px] font-semibold transition-colors select-none touch-manipulation cursor-pointer ${
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
              <div className="space-y-2">
                <button
                  type="button"
                  data-testid="preset-today-button"
                  onClick={handleSelectToday}
                  className={`w-full min-h-[48px] flex items-center justify-between rounded-none px-4 py-3 text-[14px] text-left transition-colors border select-none touch-manipulation cursor-pointer ${
                    filter.isToday
                      ? "bg-[#0B7A63]/10 text-[#0B7A63] font-bold border-[#0B7A63]"
                      : "border-slate-200 hover:bg-slate-50 text-slate-800"
                  }`}
                >
                  <span>Today (Live)</span>
                  {filter.isToday && <Icons.Check className="h-5 w-5 text-[#0B7A63]" />}
                </button>

                <button
                  type="button"
                  data-testid="preset-yesterday-button"
                  onClick={handleSelectYesterday}
                  className={`w-full min-h-[48px] flex items-center justify-between rounded-none px-4 py-3 text-[14px] text-left transition-colors border select-none touch-manipulation cursor-pointer ${
                    filter.presetKey === "yesterday"
                      ? "bg-[#0B7A63]/10 text-[#0B7A63] font-bold border-[#0B7A63]"
                      : "border-slate-200 hover:bg-slate-50 text-slate-800"
                  }`}
                >
                  <span>Yesterday</span>
                  {filter.presetKey === "yesterday" && (
                    <Icons.Check className="h-5 w-5 text-[#0B7A63]" />
                  )}
                </button>

                <button
                  type="button"
                  data-testid="preset-last7-button"
                  onClick={handleSelectLast7}
                  className={`w-full min-h-[48px] flex items-center justify-between rounded-none px-4 py-3 text-[14px] text-left transition-colors border select-none touch-manipulation cursor-pointer ${
                    filter.presetKey === "last7"
                      ? "bg-[#0B7A63]/10 text-[#0B7A63] font-bold border-[#0B7A63]"
                      : "border-slate-200 hover:bg-slate-50 text-slate-800"
                  }`}
                >
                  <span>Last 7 Days</span>
                  {filter.presetKey === "last7" && (
                    <Icons.Check className="h-5 w-5 text-[#0B7A63]" />
                  )}
                </button>
              </div>
            )}

            {/* Tab 2: Single Date (Native Date Input) */}
            {activeTab === "single" && (
              <form onSubmit={handleApplySingleDate} className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="block text-[14px] font-semibold text-slate-700 uppercase tracking-wide">
                    Choose Date
                  </label>
                  <input
                    type="date"
                    data-testid="custom-date-input"
                    value={customSingleDate}
                    max={getTodayIST()}
                    onChange={(e) => setCustomSingleDate(e.target.value)}
                    className="w-full min-h-[48px] border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-900 rounded-none focus:outline-none focus:border-[#0B7A63]"
                    required
                  />
                </div>
                <button
                  type="submit"
                  data-testid="apply-custom-date-button"
                  className="w-full min-h-[48px] bg-[#0B7A63] hover:bg-[#086350] active:bg-[#064e3e] text-white text-base font-semibold uppercase tracking-wider rounded-none select-none touch-manipulation cursor-pointer shadow-xs"
                >
                  Apply Date
                </button>
              </form>
            )}

            {/* Tab 3: Custom Range (Native Date Inputs) */}
            {activeTab === "range" && (
              <form onSubmit={handleApplyRange} className="space-y-3.5">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="block text-[14px] font-semibold text-slate-700 uppercase tracking-wide">
                      From Date
                    </label>
                    <input
                      type="date"
                      data-testid="custom-range-from-input"
                      value={customFrom}
                      max={getTodayIST()}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="w-full min-h-[48px] border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-900 rounded-none focus:outline-none focus:border-[#0B7A63]"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[14px] font-semibold text-slate-700 uppercase tracking-wide">
                      To Date
                    </label>
                    <input
                      type="date"
                      data-testid="custom-range-to-input"
                      value={customTo}
                      max={getTodayIST()}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="w-full min-h-[48px] border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-900 rounded-none focus:outline-none focus:border-[#0B7A63]"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  data-testid="apply-custom-range-button"
                  className="w-full min-h-[48px] bg-[#0B7A63] hover:bg-[#086350] active:bg-[#064e3e] text-white text-base font-semibold uppercase tracking-wider rounded-none select-none touch-manipulation cursor-pointer shadow-xs"
                >
                  Apply Range
                </button>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}
