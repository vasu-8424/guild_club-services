"use client";

import * as React from "react";
import { Icons } from "./icons";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";

export interface Column<T> {
  key: string;
  header: string;
  cell: (item: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  searchKey?: (item: T) => string;
  filterOptions?: {
    label: string;
    value: string;
  }[];
  activeFilter?: string;
  onFilterChange?: (value: string) => void;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionHref?: string;
  emptyActionLabel?: string;
  onRowClick?: (item: T) => void;
  rowActions?: (item: T) => React.ReactNode;
  className?: string;
  "data-testid"?: string;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  searchPlaceholder = "Search records...",
  searchKey,
  filterOptions,
  activeFilter,
  onFilterChange,
  pageSize = 10,
  emptyTitle = "No records found",
  emptyDescription = "There are no records matching your criteria.",
  emptyActionHref,
  emptyActionLabel,
  onRowClick,
  rowActions,
  className,
  "data-testid": testId,
}: DataTableProps<T>) {
  const [search, setSearch] = React.useState("");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("asc");

  // Filter and search data
  const filteredData = React.useMemo(() => {
    let result = [...data];

    if (search && searchKey) {
      const q = search.toLowerCase();
      result = result.filter((item) => searchKey(item).toLowerCase().includes(q));
    }

    if (sortKey) {
      result.sort((a: any, b: any) => {
        const valA = a[sortKey];
        const valB = b[sortKey];
        if (valA === valB) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;
        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        return sortOrder === "asc" ? 1 : -1;
      });
    }

    return result;
  }, [data, search, searchKey, sortKey, sortOrder]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  return (
    <div data-testid={testId} className={cn("space-y-3.5 w-full", className)}>
      {/* Search and Filters Toolbar */}
      {(searchKey || filterOptions) && (
        <div className="flex flex-col gap-2.5 w-full">
          {searchKey && (
            <div className="relative w-full">
              <Icons.Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                inputMode="search"
                enterKeyHint="search"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full min-h-[48px] rounded-none border border-slate-300 bg-white pl-10 pr-3.5 py-3 text-base text-slate-900 placeholder:text-slate-400 shadow-[0_1px_0_rgba(15,23,42,0.04)] hover:border-slate-400 focus:border-[#0B7A63] focus:outline-none focus:ring-1 focus:ring-[#0B7A63]"
              />
            </div>
          )}

          {filterOptions && onFilterChange && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {filterOptions.map((opt) => {
                const isSelected = activeFilter === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onFilterChange(opt.value);
                      setCurrentPage(1);
                    }}
                    className={cn(
                      "min-h-[44px] shrink-0 rounded-none px-4 py-2 text-[13px] font-semibold uppercase tracking-wider transition-all duration-150 cursor-pointer border select-none touch-manipulation",
                      isSelected
                        ? "bg-[#0B7A63] text-white border-[#085d4b] shadow-xs"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Stacked Cards Layout for Phone-First Ergonomics */}
      <div className="w-full">
        {paginatedData.length === 0 ? (
          <div className="p-6 bg-white border border-slate-200 shadow-xs">
            <EmptyState
              title={emptyTitle}
              description={emptyDescription}
              actionHref={emptyActionHref}
              actionLabel={emptyActionLabel}
            />
          </div>
        ) : (
          <table className="w-full block">
            {/* Semantic Header for Screen Readers / Test Finders */}
            <thead className="sr-only">
              <tr>
                {columns.map((col) => (
                  <th key={col.key}>{col.header}</th>
                ))}
                {rowActions && <th>Actions</th>}
              </tr>
            </thead>

            {/* Stacked Card Rows */}
            <tbody className="block space-y-3">
              {paginatedData.map((item, idx) => (
                <tr
                  key={(item as any).id ?? (item as any).caseId ?? (item as any).actorId ?? idx}
                  onClick={() => onRowClick?.(item)}
                  data-testid="data-table-row"
                  className={cn(
                    "block rounded-none border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)] transition-all duration-150 select-none touch-manipulation",
                    onRowClick
                      ? "cursor-pointer hover:border-[#0B7A63] active:bg-slate-50"
                      : ""
                  )}
                >
                  {/* Primary Heading from First Column */}
                  {columns.length > 0 && (
                    <td className="block border-b border-slate-100 pb-2.5 mb-2.5 font-semibold text-[16px] text-slate-900">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {columns[0].cell(item)}
                        </div>
                        {rowActions && (
                          <div
                            className="shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {rowActions(item)}
                          </div>
                        )}
                      </div>
                    </td>
                  )}

                  {/* Remaining Columns Stacked as Key-Value Pairs */}
                  <div className="space-y-2">
                    {columns.slice(1).map((col) => (
                      <td
                        key={col.key}
                        className="flex items-center justify-between text-[14px] text-slate-700 py-0.5"
                      >
                        <span className="text-[13px] font-medium text-slate-500 uppercase tracking-wide">
                          {col.header}
                        </span>
                        <div className="text-right font-medium">
                          {col.cell(item)}
                        </div>
                      </td>
                    ))}
                  </div>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination Footer */}
        {filteredData.length > pageSize && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border border-slate-200 bg-white p-3 mt-3 text-[13px] text-slate-600 shadow-xs">
            <div className="text-center sm:text-left">
              Showing{" "}
              <span className="font-semibold text-slate-900">
                {(currentPage - 1) * pageSize + 1}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-slate-900">
                {Math.min(currentPage * pageSize, filteredData.length)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-900">
                {filteredData.length}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-none border border-slate-300 bg-white text-slate-700 hover:border-[#0B7A63] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                aria-label="Previous page"
              >
                <Icons.CaretLeft className="h-4 w-4" />
              </button>

              <span className="px-2 text-sm font-semibold text-slate-900">
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-none border border-slate-300 bg-white text-slate-700 hover:border-[#0B7A63] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                aria-label="Next page"
              >
                <Icons.CaretRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
