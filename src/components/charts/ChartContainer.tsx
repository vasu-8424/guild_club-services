"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Icons, IconTile } from "@/components/ui/icons";
import type { IconProps } from "@phosphor-icons/react";

export interface ChartContainerProps {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<IconProps>;
  iconColor?: "teal" | "indigo" | "sky" | "amber" | "rose" | "slate" | "emerald";
  action?: React.ReactNode;
  onViewDetails?: () => void;
  onExportCsv?: () => void;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  className?: string;
  topAccent?: boolean;
  ariaLabel?: string;
  children: React.ReactNode;
}

export function ChartContainer({
  title,
  subtitle,
  icon,
  iconColor = "teal",
  action,
  onViewDetails,
  onExportCsv,
  isLoading = false,
  isEmpty = false,
  emptyTitle = "No data for this date range",
  emptyMessage = "There are no recorded metrics or events for the selected period.",
  className,
  topAccent = false,
  ariaLabel,
  children,
}: ChartContainerProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  const hasMenu = Boolean(onViewDetails || onExportCsv);

  return (
    <section
      aria-label={ariaLabel || `${title}: ${subtitle || ""}`}
      className={cn(
        "relative rounded-none border border-slate-200 bg-white p-5 sm:p-6 shadow-[0_1px_0_rgba(15,23,42,0.04)] flex flex-col justify-between transition-all",
        topAccent && "border-t-2 border-t-[#0B7A63]",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100/90 mb-4">
        <div className="flex items-center gap-3">
          {icon && (
            <IconTile icon={icon} color={iconColor} size={20} className="h-9 w-9" />
          )}
          <div>
            <h3 className="text-[15px] sm:text-[16px] font-semibold tracking-tight text-slate-900 leading-snug">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[12px] sm:text-[13px] text-slate-500 font-normal leading-tight mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {action}

          {hasMenu && (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                aria-label={`Options for ${title}`}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((prev) => !prev)}
                className="h-8 w-8 flex items-center justify-center rounded-none border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50 transition-colors"
              >
                <Icons.Kebab className="h-4 w-4" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1 z-40 min-w-[150px] border border-slate-200 bg-white p-1 shadow-[0_4px_12px_rgba(15,23,42,0.08)] rounded-none"
                >
                  {onViewDetails && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        onViewDetails();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-none text-left"
                    >
                      <Icons.View className="h-3.5 w-3.5 text-slate-500" />
                      <span>View details</span>
                    </button>
                  )}
                  {onExportCsv && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        onExportCsv();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-none text-left"
                    >
                      <Icons.Download className="h-3.5 w-3.5 text-slate-500" />
                      <span>Export CSV</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 w-full min-h-[260px] flex flex-col justify-center">
        {isLoading ? (
          <div className="w-full h-full min-h-[260px] flex flex-col justify-center items-center space-y-3 p-4 animate-pulse">
            <div className="h-4 bg-slate-100 rounded-none w-3/4" />
            <div className="h-40 bg-slate-50 rounded-none w-full border border-slate-100" />
            <div className="h-3 bg-slate-100 rounded-none w-1/2" />
          </div>
        ) : isEmpty ? (
          <div className="w-full h-full min-h-[260px] flex flex-col items-center justify-center p-6 text-center">
            <div className="h-12 w-12 border border-slate-200 bg-slate-50 flex items-center justify-center rounded-none mb-3 text-slate-400">
              <Icons.Analytics className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800 tracking-tight">
              {emptyTitle}
            </h4>
            <p className="text-xs text-slate-500 max-w-xs mt-1 leading-normal">
              {emptyMessage}
            </p>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
