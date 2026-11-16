"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Icons } from "@/components/ui/icons";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  getTodayIST,
  getYesterdayIST,
  getDaysAgoIST,
  parseDateFilter,
  formatDisplayDate,
} from "@/lib/date-utils";
import { Button } from "@/components/ui/button";

export function DateSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse current URL params
  const dateParam = searchParams.get("date") || undefined;
  const fromParam = searchParams.get("from") || undefined;
  const toParam = searchParams.get("to") || undefined;

  const filter = parseDateFilter({
    date: dateParam,
    from: fromParam,
    to: toParam,
  });

  const todayIST = getTodayIST();
  const selectedDate = filter.startDate || todayIST;

  // Calendar is open by default on dashboard so admin can immediately choose dates
  const [isOpen, setIsOpen] = React.useState(true);

  // Month navigation state: initialize to selectedDate's month and year
  const initialYearMonth = React.useMemo(() => {
    const [y, m] = selectedDate.split("-");
    return {
      year: parseInt(y, 10) || new Date().getFullYear(),
      month: (parseInt(m, 10) || 1) - 1, // 0-indexed
    };
  }, [selectedDate]);

  const [currentYear, setCurrentYear] = React.useState(initialYearMonth.year);
  const [currentMonth, setCurrentMonth] = React.useState(initialYearMonth.month);

  // Keep month view synced if selectedDate changes from outside (e.g., URL change)
  React.useEffect(() => {
    const [y, m] = selectedDate.split("-");
    const parsedYear = parseInt(y, 10);
    const parsedMonth = parseInt(m, 10) - 1;
    if (!isNaN(parsedYear) && !isNaN(parsedMonth)) {
      setCurrentYear(parsedYear);
      setCurrentMonth(parsedMonth);
    }
  }, [selectedDate]);

  const applyParams = (params: Record<string, string | null>) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    for (const [key, val] of Object.entries(params)) {
      if (val === null) {
        current.delete(key);
      } else {
        current.set(key, val);
      }
    }
    const qs = current.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  };

  const handleSelectDate = (dateStr: string) => {
    if (dateStr === todayIST) {
      applyParams({ date: null, from: null, to: null });
    } else {
      applyParams({ date: dateStr, from: null, to: null });
    }
  };

  const handleSelectToday = () => {
    const [y, m] = todayIST.split("-");
    setCurrentYear(parseInt(y, 10));
    setCurrentMonth(parseInt(m, 10) - 1);
    applyParams({ date: null, from: null, to: null });
  };

  const handleSelectYesterday = () => {
    const yest = getYesterdayIST();
    const [y, m] = yest.split("-");
    setCurrentYear(parseInt(y, 10));
    setCurrentMonth(parseInt(m, 10) - 1);
    applyParams({ date: yest, from: null, to: null });
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Build calendar month days
  const monthData = React.useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const days: Array<{
      dateStr: string | null;
      dayNum: number | null;
      isToday: boolean;
      isSelected: boolean;
      isFuture: boolean;
      isPast: boolean;
    }> = [];

    // Leading blanks
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({
        dateStr: null,
        dayNum: null,
        isToday: false,
        isSelected: false,
        isFuture: false,
        isPast: false,
      });
    }

    // Days in current month
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const monthStr = String(currentMonth + 1).padStart(2, "0");
      const dayStr = String(d).padStart(2, "0");
      const dateStr = `${currentYear}-${monthStr}-${dayStr}`;

      const isToday = dateStr === todayIST;
      const isSelected = dateStr === selectedDate;
      const isFuture = dateStr > todayIST;
      const isPast = dateStr < todayIST;

      days.push({
        dateStr,
        dayNum: d,
        isToday,
        isSelected,
        isFuture,
        isPast,
      });
    }

    return days;
  }, [currentYear, currentMonth, todayIST, selectedDate]);

  const monthTitle = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(currentYear, currentMonth, 1));

  return (
    <div className="w-full space-y-3">
      {/* 1. Header Bar / Toggle Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="date-selector-button"
          onClick={() => setIsOpen(!isOpen)}
          leadingIcon={<Icons.Calendar className="h-4 w-4 text-[#0B7A63] shrink-0" />}
          trailingIcon={
            isOpen ? (
              <Icons.CaretDown className="h-4 w-4 text-slate-500 rotate-180 transition-transform shrink-0" />
            ) : (
              <Icons.CaretDown className="h-4 w-4 text-slate-500 transition-transform shrink-0" />
            )
          }
          className="w-full sm:w-auto min-h-[48px] h-12 px-4 justify-between border border-slate-300 bg-white hover:border-[#0B7A63] text-left transition-colors select-none touch-manipulation cursor-pointer rounded-none"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2 truncate">
            <span className="font-semibold text-slate-900 text-[14px]">
              {filter.filterLabel}
            </span>
            {filter.isPast && (
              <span className="inline-flex items-center rounded-none bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 uppercase tracking-wider shrink-0">
                Past
              </span>
            )}
            {filter.isToday && (
              <span className="inline-flex items-center rounded-none bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 uppercase tracking-wider shrink-0">
                Live
              </span>
            )}
          </div>
          <span className="text-xs text-[#0B7A63] font-medium ml-2 shrink-0">
            {isOpen ? "Hide Calendar" : "Choose from Calendar"}
          </span>
        </Button>

        {/* Quick Shortcut Buttons for fast 1-tap switching */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            data-testid="preset-today-button"
            onClick={handleSelectToday}
            className={`flex-1 sm:flex-none min-h-[44px] h-11 px-3 text-xs font-semibold uppercase tracking-wider border rounded-none transition-colors select-none touch-manipulation cursor-pointer ${
              filter.isToday
                ? "bg-[#0B7A63] text-white border-[#0B7A63]"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            }`}
          >
            Today
          </button>
          <button
            type="button"
            data-testid="preset-yesterday-button"
            onClick={handleSelectYesterday}
            className={`flex-1 sm:flex-none min-h-[44px] h-11 px-3 text-xs font-semibold uppercase tracking-wider border rounded-none transition-colors select-none touch-manipulation cursor-pointer ${
              filter.presetKey === "yesterday"
                ? "bg-[#0B7A63] text-white border-[#0B7A63]"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            }`}
          >
            Yesterday
          </button>
        </div>
      </div>

      {/* 2. Interactive Monthly Calendar View */}
      {isOpen && (
        <div
          data-testid="date-selector-dropdown"
          className="w-full rounded-none border border-slate-200 bg-white shadow-xs p-3 sm:p-5 animate-in fade-in-50 duration-150"
        >
          {/* Calendar Navigation Header */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Icons.Calendar className="h-4 w-4 text-[#0B7A63]" />
              <h2 className="text-sm sm:text-base font-bold uppercase tracking-tight text-slate-900">
                {monthTitle}
              </h2>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                data-testid="calendar-prev-month-btn"
                onClick={handlePrevMonth}
                title="Previous Month"
                className="min-h-[40px] min-w-[40px] p-2 border border-slate-300 text-slate-600 hover:bg-slate-100 active:bg-slate-200 rounded-none cursor-pointer flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <button
                type="button"
                data-testid="calendar-today-btn"
                onClick={handleSelectToday}
                title="Jump to Today"
                className="min-h-[40px] px-2.5 border border-slate-300 text-slate-700 hover:bg-slate-100 active:bg-slate-200 text-xs font-semibold uppercase tracking-wider rounded-none cursor-pointer flex items-center justify-center transition-colors"
              >
                Today
              </button>

              <button
                type="button"
                data-testid="calendar-next-month-btn"
                onClick={handleNextMonth}
                title="Next Month"
                className="min-h-[40px] min-w-[40px] p-2 border border-slate-300 text-slate-600 hover:bg-slate-100 active:bg-slate-200 rounded-none cursor-pointer flex items-center justify-center transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Day Grid */}
          <div className="grid grid-cols-7 gap-1">
            {monthData.map((day, idx) => {
              if (!day.dateStr || day.dayNum === null) {
                return (
                  <div
                    key={`blank-${idx}`}
                    className="min-h-[44px] h-11 sm:h-12 bg-slate-50/40 border border-slate-100 rounded-none pointer-events-none opacity-40"
                  />
                );
              }

              // Styling states
              let cellClass = "bg-white border-slate-200 text-slate-800 hover:bg-slate-50";
              let labelClass = "text-slate-500";

              if (day.isSelected) {
                // Active selected date
                cellClass = "bg-[#0B7A63] border-[#0B7A63] text-white font-bold shadow-xs hover:bg-[#086350]";
                labelClass = "text-emerald-100";
              } else if (day.isToday) {
                // Today (not currently selected)
                cellClass = "bg-emerald-50/60 border-emerald-400 text-[#0B7A63] font-bold ring-2 ring-[#0B7A63] ring-inset hover:bg-emerald-100";
                labelClass = "text-[#0B7A63]";
              } else if (day.isFuture) {
                // Future dates are muted
                cellClass = "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed";
                labelClass = "text-slate-300";
              }

              const isClickable = !day.isFuture;

              return (
                <button
                  key={day.dateStr}
                  type="button"
                  data-testid={`calendar-day-${day.dateStr}`}
                  disabled={!isClickable}
                  onClick={() => day.dateStr && handleSelectDate(day.dateStr)}
                  title={`${day.dateStr}${day.isToday ? " (Today)" : ""}${day.isSelected ? " - Selected" : ""}`}
                  className={`min-h-[44px] h-11 sm:h-12 p-1 border rounded-none flex flex-col items-center justify-between transition-colors select-none touch-manipulation cursor-pointer ${cellClass}`}
                >
                  <span className="text-xs sm:text-sm font-mono font-bold leading-none mt-0.5">
                    {day.dayNum}
                  </span>
                  <span className={`text-[9px] font-sans uppercase tracking-tight leading-none mb-0.5 ${labelClass}`}>
                    {day.isSelected ? "Active" : day.isToday ? "Today" : ""}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Calendar Selection Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-3 border-t border-slate-100 text-xs text-slate-500">
            <div className="flex items-center gap-1.5 font-medium">
              <span>Selected date:</span>
              <strong className="text-slate-900 font-semibold">
                {formatDisplayDate(selectedDate)}
              </strong>
              {filter.isToday ? (
                <span className="text-emerald-700 font-bold">(Today)</span>
              ) : (
                <span className="text-amber-700 font-bold">(Viewing History)</span>
              )}
            </div>

            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 bg-[#0B7A63]" />
                Selected
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 border-2 border-[#0B7A63] bg-emerald-50" />
                Today
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
