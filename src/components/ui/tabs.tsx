"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
  badge?: string | number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex items-center gap-1 border-b border-slate-200 overflow-x-auto no-scrollbar",
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              "group inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold rounded-none transition-all duration-150 whitespace-nowrap cursor-pointer",
              isActive
                ? "border-[#0B7A63] text-[#0B7A63] bg-[#0B7A63]/5"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50"
            )}
          >
            {tab.icon && (
              <span
                className={cn(
                  "transition-colors",
                  isActive ? "text-[#0B7A63]" : "text-slate-400 group-hover:text-slate-600"
                )}
              >
                {tab.icon}
              </span>
            )}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={cn(
                  "rounded-[2px] px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
                  isActive
                    ? "bg-[#0B7A63] text-white"
                    : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
