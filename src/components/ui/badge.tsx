import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | "default"
    | "secondary"
    | "outline"
    | "neutral"
    | "success"
    | "warning"
    | "danger"
    | "info"
    | "role_super_admin"
    | "role_admin"
    | "role_therapist";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  const variantStyles = {
    default: "bg-slate-900 text-white border-transparent",
    secondary: "bg-slate-100 text-slate-800 border-slate-200",
    outline: "border border-slate-300 text-slate-700 bg-white",
    neutral: "bg-slate-100 text-slate-700 border border-slate-200",
    success: "bg-emerald-50 text-emerald-800 border border-emerald-200",
    warning: "bg-amber-50 text-amber-800 border border-amber-200",
    danger: "bg-rose-50 text-rose-800 border border-rose-200",
    info: "bg-sky-50 text-sky-800 border border-sky-200",
    role_super_admin:
      "bg-purple-50 text-purple-800 border border-purple-200 font-bold tracking-wider uppercase",
    role_admin:
      "bg-indigo-50 text-indigo-800 border border-indigo-200 font-bold tracking-wider uppercase",
    role_therapist:
      "bg-teal-50 text-teal-800 border border-teal-200 font-bold tracking-wider uppercase",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-[2px] px-2 py-0.5 text-[11px] font-semibold tracking-wider uppercase transition-colors border",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}
