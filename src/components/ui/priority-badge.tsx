import * as React from "react";
import { Badge } from "./badge";
import type { CasePriority } from "@/db/schema";
import { cn } from "@/lib/utils";

interface PriorityBadgeProps {
  priority: CasePriority | string;
  className?: string;
  showDot?: boolean;
}

export function PriorityBadge({ priority, className, showDot = true }: PriorityBadgeProps) {
  const norm = (priority || "").toLowerCase();

  switch (norm) {
    case "urgent":
      return (
        <Badge
          variant="danger"
          className={cn("bg-rose-100 text-rose-800 border-rose-300 font-bold tracking-wider", className)}
        >
          {showDot && <span className="mr-1.5 h-1.5 w-1.5 rounded-[1px] bg-rose-600 shrink-0" />}
          URGENT
        </Badge>
      );
    case "high":
      return (
        <Badge
          variant="warning"
          className={cn("bg-orange-50 text-orange-800 border-orange-200 font-bold tracking-wider", className)}
        >
          {showDot && <span className="mr-1.5 h-1.5 w-1.5 rounded-[1px] bg-orange-600 shrink-0" />}
          HIGH
        </Badge>
      );
    case "medium":
      return (
        <Badge
          variant="warning"
          className={cn("bg-amber-50 text-amber-800 border-amber-200 font-bold tracking-wider", className)}
        >
          {showDot && <span className="mr-1.5 h-1.5 w-1.5 rounded-[1px] bg-amber-600 shrink-0" />}
          MEDIUM
        </Badge>
      );
    case "low":
      return (
        <Badge
          variant="neutral"
          className={cn("bg-slate-100 text-slate-700 border-slate-200 font-bold tracking-wider", className)}
        >
          {showDot && <span className="mr-1.5 h-1.5 w-1.5 rounded-[1px] bg-slate-500 shrink-0" />}
          LOW
        </Badge>
      );
    default:
      return (
        <Badge variant="neutral" className={cn("font-bold tracking-wider", className)}>
          {priority ? priority.toUpperCase() : "NORMAL"}
        </Badge>
      );
  }
}
