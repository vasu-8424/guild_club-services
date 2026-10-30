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
    <div data-testid={testId} className={cn("space-y-3.5", className)}>
      {/* Search and Filters Toolbar */}
      {(searchKey || filterOptions) && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {searchKey && (
            <div className="relative flex-1 max-w-sm">
              <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-none border border-slate-300 bg-white pl-9 pr-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 shadow-[0_1px_0_rgba(15,23,42,0.04)] hover:border-slate-400 focus:border-[#0B7A63] focus:outline-none focus:ring-1 focus:ring-[#0B7A63]"
              />
            </div>
          )}

          {filterOptions && onFilterChange && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="text-xs text-slate-400 mr-1 flex items-center gap-1">
                <Icons.Filter className="h-3.5 w-3.5" />
              </span>
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
                      "rounded-none px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all duration-150 cursor-pointer border",
                      isSelected
                        ? "bg-[#0B7A63] text-white border-[#085d4b] shadow-xs"
                        : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 hover:text-slate-900"
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

      {/* Table Container */}
      <div className="rounded-none border border-slate-200 bg-white overflow-hidden shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        {paginatedData.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title={emptyTitle}
              description={emptyDescription}
              actionHref={emptyActionHref}
              actionLabel={emptyActionLabel}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-700 select-none">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => col.sortable && toggleSort(col.key)}
                      className={cn(
                        "px-4 py-3 font-semibold tracking-wider text-[11px] uppercase text-slate-500",
                        col.sortable && "cursor-pointer hover:text-slate-900",
                        col.className
                      )}
                    >
                      <div className="flex items-center gap-1">
                        <span>{col.header}</span>
                        {col.sortable && sortKey === col.key && (
                          sortOrder === "asc" ? (
                            <Icons.CaretUp className="h-3 w-3 text-[#0B7A63]" />
                          ) : (
                            <Icons.CaretDown className="h-3 w-3 text-[#0B7A63]" />
                          )
                        )}
                      </div>
                    </th>
                  ))}
                  {rowActions && (
                    <th className="px-4 py-3 text-right font-semibold tracking-wider text-[11px] uppercase text-slate-500">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedData.map((item, idx) => (
                  <tr
                    key={(item as any).id ?? (item as any).caseId ?? (item as any).actorId ?? idx}
                    onClick={() => onRowClick?.(item)}
                    className={cn(
                      "transition-colors duration-150 group",
                      onRowClick
                        ? "cursor-pointer hover:bg-slate-50/80"
                        : "hover:bg-slate-50/50"
                    )}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn("px-4 py-3 text-slate-700", col.className)}
                      >
                        {col.cell(item)}
                      </td>
                    ))}
                    {rowActions && (
                      <td
                        className="px-4 py-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {rowActions(item)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {filteredData.length > pageSize && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs text-slate-500">
            <div className="text-center sm:text-left">
              Showing{" "}
              <span className="font-semibold text-slate-800">
                {(currentPage - 1) * pageSize + 1}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-slate-800">
                {Math.min(currentPage * pageSize, filteredData.length)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-800">
                {filteredData.length}
              </span>{" "}
              records
            </div>

            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-none border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:border-[#0B7A63] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <Icons.CaretLeft className="h-3.5 w-3.5" />
              </button>

              {Array.from({ length: Math.min(totalPages, 5) }).map((_, pIdx) => {
                const pageNum = pIdx + 1;
                const isCurrent = pageNum === currentPage;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-none text-xs font-semibold transition-colors border",
                      isCurrent
                        ? "bg-[#0B7A63] text-white border-[#085d4b]"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {totalPages > 5 && (
                <span className="px-1 text-slate-400">...</span>
              )}

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-none border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:border-[#0B7A63] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                <Icons.CaretRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
