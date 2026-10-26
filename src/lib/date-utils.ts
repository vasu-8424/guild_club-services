/**
 * Timezone and Date Utilities for Guild Club Services
 * Default application timezone is strictly Asia/Kolkata.
 */

export const APP_TIMEZONE = "Asia/Kolkata";

/**
 * Returns the current date formatted as YYYY-MM-DD in Asia/Kolkata timezone.
 */
export function getTodayIST(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

/**
 * Returns yesterday's date formatted as YYYY-MM-DD in Asia/Kolkata timezone.
 */
export function getYesterdayIST(): string {
  const todayStr = getTodayIST();
  const [year, month, day] = todayStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Returns date N days ago in Asia/Kolkata.
 */
export function getDaysAgoIST(days: number): string {
  const todayStr = getTodayIST();
  const [year, month, day] = todayStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/**
 * Returns date N days ahead in Asia/Kolkata.
 */
export function getDaysAheadIST(days: number): string {
  const todayStr = getTodayIST();
  const [year, month, day] = todayStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export interface DateFilterRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  isPast: boolean;
  isToday: boolean;
  isRange: boolean;
  filterLabel: string;
  presetKey?: "today" | "yesterday" | "last7" | "custom_date" | "custom_range";
}

/**
 * Parses search parameters and returns sanitized date bounds in Asia/Kolkata.
 */
export function parseDateFilter(searchParams?: {
  date?: string | string[];
  from?: string | string[];
  to?: string | string[];
}): DateFilterRange {
  const today = getTodayIST();
  const yesterday = getYesterdayIST();
  const last7Start = getDaysAgoIST(6);

  const rawDate = Array.isArray(searchParams?.date) ? searchParams.date[0] : searchParams?.date;
  const rawFrom = Array.isArray(searchParams?.from) ? searchParams.from[0] : searchParams?.from;
  const rawTo = Array.isArray(searchParams?.to) ? searchParams.to[0] : searchParams?.to;

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  // Check Range first
  if (rawFrom && dateRegex.test(rawFrom)) {
    const from = rawFrom;
    const to = rawTo && dateRegex.test(rawTo) ? rawTo : from;
    const startDate = from <= to ? from : to;
    const endDate = from <= to ? to : from;

    let preset: DateFilterRange["presetKey"] = "custom_range";
    let label = `${formatDisplayDate(startDate)} – ${formatDisplayDate(endDate)}`;

    if (startDate === last7Start && endDate === today) {
      preset = "last7";
      label = "Last 7 Days";
    }

    const isToday = startDate === today && endDate === today;
    const isPast = endDate < today;

    return {
      startDate,
      endDate,
      isPast,
      isToday,
      isRange: startDate !== endDate,
      filterLabel: label,
      presetKey: preset,
    };
  }

  // Single date
  if (rawDate && dateRegex.test(rawDate)) {
    const isToday = rawDate === today;
    const isPast = rawDate < today;
    let preset: DateFilterRange["presetKey"] = "custom_date";
    let label = formatDisplayDate(rawDate);

    if (rawDate === today) {
      preset = "today";
      label = `Today (${formatDisplayDate(today)})`;
    } else if (rawDate === yesterday) {
      preset = "yesterday";
      label = `Yesterday (${formatDisplayDate(yesterday)})`;
    }

    return {
      startDate: rawDate,
      endDate: rawDate,
      isPast,
      isToday,
      isRange: false,
      filterLabel: label,
      presetKey: preset,
    };
  }

  // Default: Today
  return {
    startDate: today,
    endDate: today,
    isPast: false,
    isToday: true,
    isRange: false,
    filterLabel: `Today (${formatDisplayDate(today)})`,
    presetKey: "today",
  };
}

/**
 * Format YYYY-MM-DD into a human-friendly string like "22 Oct 2026"
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Format a Date or timestamp string to IST localized time (e.g. 02:45 PM)
 */
export function formatTimeIST(dateInput: Date | string): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/**
 * Format a Date or timestamp string to IST localized date + time
 */
export function formatDateTimeIST(dateInput: Date | string): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: APP_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/**
 * Converts a Date or ISO timestamp string into YYYY-MM-DD in Asia/Kolkata timezone.
 */
export function formatToISTDateString(dateInput: Date | string): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
