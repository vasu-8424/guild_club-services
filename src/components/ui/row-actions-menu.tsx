"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "./button";
import { Icons } from "./icons";
import { cn } from "@/lib/utils";

export interface RowActionMenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive" | "warning";
  disabled?: boolean;
  isDividerBefore?: boolean;
  "data-testid"?: string;
  title?: string;
}

export interface RowActionsMenuProps {
  items: RowActionMenuItem[];
  triggerTestId?: string;
  menuTestId?: string;
  align?: "left" | "right";
  buttonTitle?: string;
}

/**
 * Accessible sharp-cornered kebab (three-dots) dropdown menu for table rows.
 * Features:
 * - 0px radius sharp corners
 * - Escape key to dismiss
 * - Arrow up/down keyboard navigation
 * - Outside click dismiss
 * - High contrast accessible active/hover states
 */
export function RowActionsMenu({
  items,
  triggerTestId = "row-actions-kebab",
  menuTestId = "row-actions-menu",
  align = "right",
  buttonTitle = "More actions",
}: RowActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
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

  // Keyboard navigation inside dropdown
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setIsOpen(true);
          setFocusedIndex(0);
        }
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        setFocusedIndex(-1);
        return;
      }

      const activeItems = items.filter((item) => !item.disabled);
      if (activeItems.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % items.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + items.length) % items.length);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (focusedIndex >= 0 && items[focusedIndex] && !items[focusedIndex].disabled) {
          items[focusedIndex].onClick();
          setIsOpen(false);
        }
      }
    },
    [isOpen, items, focusedIndex]
  );

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center"
      onKeyDown={handleKeyDown}
    >
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className={cn(
          "h-[36px] w-[36px] text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-300",
          isOpen && "bg-slate-100 text-slate-900 border-slate-300"
        )}
        onClick={() => {
          setIsOpen((prev) => !prev);
          setFocusedIndex(-1);
        }}
        data-testid={triggerTestId}
        title={buttonTitle}
        aria-label={buttonTitle}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Icons.DotsThreeVertical className="h-4 w-4" />
      </Button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-orientation="vertical"
          data-testid={menuTestId}
          className={cn(
            "absolute top-full mt-1 w-48 bg-white border border-slate-200 shadow-lg z-50 py-1 rounded-none select-none",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {items.map((item, index) => {
            const isDestructive = item.variant === "destructive";
            const isWarning = item.variant === "warning";

            return (
              <React.Fragment key={item.key}>
                {item.isDividerBefore && (
                  <div className="my-1 border-t border-slate-100" />
                )}
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  data-testid={item["data-testid"]}
                  title={item.title}
                  onClick={() => {
                    if (!item.disabled) {
                      item.onClick();
                      setIsOpen(false);
                    }
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-left transition-colors cursor-pointer rounded-none outline-none whitespace-nowrap",
                    focusedIndex === index ? "bg-slate-100" : "",
                    isDestructive
                      ? "text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      : isWarning
                      ? "text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900",
                    item.disabled && "opacity-40 cursor-not-allowed pointer-events-none"
                  )}
                >
                  {item.icon && (
                    <span className="shrink-0 w-4 h-4 flex items-center justify-center [&_svg]:w-4 [&_svg]:h-4">
                      {item.icon}
                    </span>
                  )}
                  <span className="truncate">{item.label}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
