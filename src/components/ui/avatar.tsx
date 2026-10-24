import * as React from "react";
import { cn } from "@/lib/utils";

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  size?: "sm" | "md" | "lg";
  variant?: "brand" | "slate" | "amber" | "sky" | "rose" | "indigo";
}

export function Avatar({
  name,
  size = "md",
  variant = "brand",
  className,
  ...props
}: AvatarProps) {
  const initials = (name || "")
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  const sizeClasses = {
    sm: "h-7 w-7 text-[11px]",
    md: "h-9 w-9 text-xs",
    lg: "h-11 w-11 text-sm font-semibold",
  };

  const variantClasses = {
    brand: "bg-[#0B7A63]/10 text-[#0B7A63] border border-[#0B7A63]/30",
    slate: "bg-slate-100 text-slate-700 border border-slate-200",
    amber: "bg-amber-50 text-amber-800 border border-amber-200",
    sky: "bg-sky-50 text-sky-800 border border-sky-200",
    rose: "bg-rose-50 text-rose-800 border border-rose-200",
    indigo: "bg-[#4338CA]/10 text-[#4338CA] border border-[#4338CA]/30",
  };

  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[2px] font-semibold select-none shadow-[0_1px_0_rgba(15,23,42,0.04)]",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {initials}
    </div>
  );
}
