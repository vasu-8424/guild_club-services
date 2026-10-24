import * as React from "react";
import { cn } from "@/lib/utils";
import { Icons } from "./icons";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "secondary"
    | "outline"
    | "ghost"
    | "destructive"
    | "icon";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  showArrow?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      leadingIcon,
      trailingIcon,
      showArrow = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    // Sharp corners (0px) app-wide, semibold text, transition
    const baseStyles =
      "group inline-flex items-center justify-center font-semibold rounded-none transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none select-none cursor-pointer tracking-tight";

    const variantStyles = {
      primary:
        "bg-[#0B7A63] text-white border-t border-x border-[#085d4b] border-b-2 border-b-[#064336] hover:brightness-105 active:brightness-95 active:border-b focus-visible:ring-[#0B7A63] shadow-[0_1px_2px_rgba(11,122,99,0.2)]",
      secondary:
        "bg-white text-slate-800 border border-slate-300 hover:border-[#0B7A63] hover:text-[#0B7A63] active:bg-slate-50 focus-visible:ring-[#0B7A63] shadow-[0_1px_0_rgba(15,23,42,0.04)]",
      outline:
        "bg-white text-slate-800 border border-slate-300 hover:border-[#0B7A63] hover:text-[#0B7A63] active:bg-slate-50 focus-visible:ring-[#0B7A63] shadow-[0_1px_0_rgba(15,23,42,0.04)]",
      ghost:
        "bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 focus-visible:ring-slate-400 border border-transparent",
      destructive:
        "bg-rose-700 text-white border-t border-x border-rose-800 border-b-2 border-b-rose-950 hover:bg-rose-600 active:bg-rose-800 active:border-b focus-visible:ring-rose-600 shadow-[0_1px_2px_rgba(190,18,60,0.2)]",
      icon:
        "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-[#0B7A63] hover:text-[#0B7A63] active:bg-slate-100 focus-visible:ring-[#0B7A63] p-0 shadow-[0_1px_0_rgba(15,23,42,0.04)]",
    };

    const isIconButton = variant === "icon" || size === "icon";

    const sizeStyles = {
      sm: isIconButton
        ? "h-9 w-9 p-0"
        : "h-9 px-3.5 text-[13px] sm:text-[14px] gap-2",
      md: isIconButton
        ? "h-10 w-10 sm:h-11 sm:w-11 p-0"
        : "h-11 px-4 text-[14px] sm:text-[15px] gap-2.5",
      lg: isIconButton
        ? "h-12 w-12 p-0"
        : "h-12 px-5 text-[15px] gap-3",
      icon: "h-10 w-10 sm:h-11 sm:w-11 p-0",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Icons.Spinner className="h-4 w-4 shrink-0 text-current" />
        ) : (
          leadingIcon && (
            <span className="shrink-0 transition-transform">{leadingIcon}</span>
          )
        )}
        {children && <span>{children}</span>}
        {trailingIcon && !isLoading && (
          <span className="shrink-0 transition-transform">{trailingIcon}</span>
        )}
        {showArrow && !isLoading && (
          <Icons.ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" />
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
