import * as React from "react";
import { Badge } from "./badge";
import type { CaseStatus } from "@/db/schema";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: CaseStatus | string;
  className?: string;
  showDot?: boolean;
}

/**
 * Standard StatusBadge:
 * - Fixed height: 24px (h-[24px])
 * - Text: 12px uppercase, whitespace-nowrap, leading-none
 * - Small square dot: 6px square (rounded-none)
 */
export function StatusBadge({ status, className, showDot = true }: StatusBadgeProps) {
  const norm = (status || "").toLowerCase();

  const baseStyle =
    "h-[24px] px-2 text-[12px] uppercase whitespace-nowrap leading-none shrink-0 inline-flex items-center rounded-none font-semibold tracking-wider";

  switch (norm) {
    case "new":
      return (
        <Badge variant="neutral" className={cn(baseStyle, className)}>
          {showDot && <span className="mr-1.5 h-1.5 w-1.5 rounded-none bg-slate-500 shrink-0" />}
          NEW
        </Badge>
      );
    case "assigned":
      return (
        <Badge variant="info" className={cn(baseStyle, className)}>
          {showDot && <span className="mr-1.5 h-1.5 w-1.5 rounded-none bg-sky-600 shrink-0" />}
          ASSIGNED
        </Badge>
      );
    case "accepted":
      return (
        <Badge variant="info" className={cn(baseStyle, className)}>
          {showDot && <span className="mr-1.5 h-1.5 w-1.5 rounded-none bg-sky-600 shrink-0" />}
          ACCEPTED
        </Badge>
      );
    case "in_progress":
      return (
        <Badge variant="info" className={cn(baseStyle, className)}>
          {showDot && <span className="mr-1.5 h-1.5 w-1.5 rounded-none bg-sky-600 shrink-0" />}
          IN PROGRESS
        </Badge>
      );
    case "on_hold":
    case "pending":
      return (
        <Badge variant="warning" className={cn(baseStyle, className)}>
          {showDot && <span className="mr-1.5 h-1.5 w-1.5 rounded-none bg-amber-600 shrink-0" />}
          ON HOLD
        </Badge>
      );
    case "completed":
    case "discharged":
      return (
        <Badge variant="success" className={cn(baseStyle, className)}>
          {showDot && <span className="mr-1.5 h-1.5 w-1.5 rounded-none bg-emerald-600 shrink-0" />}
          COMPLETED
        </Badge>
      );
    case "active":
      return (
        <Badge variant="success" className={cn(baseStyle, className)}>
          {showDot && <span className="mr-1.5 h-1.5 w-1.5 rounded-none bg-emerald-600 shrink-0" />}
          ACTIVE
        </Badge>
      );
    case "urgent":
      return (
        <Badge variant="danger" className={cn(baseStyle, className)}>
          {showDot && <span className="mr-1.5 h-1.5 w-1.5 rounded-none bg-rose-600 shrink-0" />}
          URGENT
        </Badge>
      );
    case "declined":
    case "cancelled":
    case "inactive":
    case "deactivated":
      return (
        <Badge variant="danger" className={cn(baseStyle, className)}>
          {showDot && <span className="mr-1.5 h-1.5 w-1.5 rounded-none bg-rose-600 shrink-0" />}
          {norm === "inactive" || norm === "deactivated" ? "INACTIVE" : norm === "declined" ? "DECLINED" : "CANCELLED"}
        </Badge>
      );
    default:
      return (
        <Badge variant="neutral" className={cn(baseStyle, className)}>
          {status ? status.toUpperCase() : "UNKNOWN"}
        </Badge>
      );
  }
}
