import * as React from "react";
import { Badge } from "./badge";
import type { CaseStatus } from "@/db/schema";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: CaseStatus | string;
  className?: string;
  showDot?: boolean;
}

export function StatusBadge({ status, className, showDot = true }: StatusBadgeProps) {
  const norm = (status || "").toLowerCase();

  switch (norm) {
    case "new":
      return (
        <Badge variant="neutral" className={cn("text-[11px] font-bold tracking-wider", className)}>
          {showDot && <span className="mr-1.5 h-1.5 w-1.5 rounded-[1px] bg-slate-500 shrink-0" />}
          NEW
        </Badge>
      );
    case "assigned":
      return (
        <Badge variant="info" className={cn("text-[11px] font-bold tracking-wider", className)}>
          {showDot && <span className="mr-1.5 h-1.5 w-1.5 rounded-[1px] bg-sky-600 shrink-0" />}
          ASSIGNED
        </Badge>
      );
    case "accepted":
      return (
        <Badge variant="info" className={cn("text-[11px] font-bold tracking-wider", className)}>
          {showDot && <span className="mr-1.5 h-1.5 w-1.5 rounded-[1px] bg-sky-600 shrink-0" />}
          ACCEPTED
        </Badge>
      );
    case "in_progress":
      return (
        <Badge variant="info" className={cn("text-[11px] font-bold tracking-wider", className)}>
          {showDot && <span className="mr-1.5 h-1.5 w-1.5 rounded-[1px] bg-sky-600 shrink-0" />}
          IN PROGRESS
        </Badge>
      );
    case "on_hold":
    case "pending":
      return (
        <Badge variant="warning" className={cn("text-[11px] font-bold tracking-wider", className)}>
          {showDot && <span className="mr-1.5 h-1.5 w-1.5 rounded-[1px] bg-amber-600 shrink-0" />}
          ON HOLD
        </Badge>
      );
    case "completed":
    case "discharged":
      return (
        <Badge variant="success" className={cn("text-[11px] font-bold tracking-wider", className)}>
          {showDot && <span className="mr-1.5 h-1.5 w-1.5 rounded-[1px] bg-emerald-600 shrink-0" />}
          COMPLETED
        </Badge>
      );
    case "active":
      return (
        <Badge variant="success" className={cn("text-[11px] font-bold tracking-wider", className)}>
          {showDot && <span className="mr-1.5 h-1.5 w-1.5 rounded-[1px] bg-emerald-600 shrink-0" />}
          ACTIVE
        </Badge>
      );
    case "urgent":
      return (
        <Badge variant="danger" className={cn("text-[11px] font-bold tracking-wider", className)}>
          {showDot && <span className="mr-1.5 h-1.5 w-1.5 rounded-[1px] bg-rose-600 shrink-0" />}
          URGENT
        </Badge>
      );
    case "declined":
    case "cancelled":
    case "inactive":
    case "deactivated":
      return (
        <Badge variant="danger" className={cn("text-[11px] font-bold tracking-wider", className)}>
          {showDot && <span className="mr-1.5 h-1.5 w-1.5 rounded-[1px] bg-rose-600 shrink-0" />}
          {norm === "inactive" || norm === "deactivated" ? "INACTIVE" : norm === "declined" ? "DECLINED" : "CANCELLED"}
        </Badge>
      );
    default:
      return (
        <Badge variant="neutral" className={cn("text-[11px] font-bold tracking-wider", className)}>
          {status ? status.toUpperCase() : "UNKNOWN"}
        </Badge>
      );
  }
}
