import * as React from "react";
import { cn } from "@/lib/utils";
import { Icons } from "./icons";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "destructive-outline"
  | "warning-outline"
  | "link"
  | "icon";

export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leadingIcon?: React.ReactNode;
  icon?: React.ReactNode; // Alias for leadingIcon
  trailingIcon?: React.ReactNode;
  showArrow?: boolean;
  asChild?: boolean;
}

/**
 * Single source of truth Button component for Guild Club Services.
 *
 * RULES:
 * 1. Sharp corners: 0px radius (rounded-none) app-wide.
 * 2. Fixed heights: sm = 36px, md = 44px, lg = 48px, icon = 40px, icon-sm = 36px.
 * 3. Never wrap: whitespace-nowrap, leading-none, font-semibold.
 * 4. Icons: Rendered via `leadingIcon` (or `icon`) / `trailingIcon`. Always side-by-side with text, shrink-0, display block.
 *
 * WARNING: DO NOT override display, flex-direction, gap, or fixed height with className.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      leadingIcon,
      icon,
      trailingIcon,
      showArrow = false,
      children,
      disabled,
      title,
      "aria-label": ariaLabel,
      ...props
    },
    ref
  ) => {
    const effectiveLeadingIcon = leadingIcon ?? icon;
    const isIconButton = variant === "icon" || size === "icon" || size === "icon-sm";

    // Strict single-source layout rules
    const baseLayout =
      "btn relative inline-flex flex-row items-center justify-center box-border shrink-0 min-w-0 select-none font-semibold rounded-none tracking-tight whitespace-nowrap leading-none transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7A63] focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed";

    const variantStyles: Record<ButtonVariant, string> = {
      // Primary: solid deep teal with 2px darker bottom border
      primary:
        "bg-[#0B7A63] text-white border-t border-x border-[#085d4b] border-b-2 border-b-[#064336] hover:brightness-105 active:brightness-95 active:border-b shadow-[0_1px_2px_rgba(11,122,99,0.2)]",

      // Secondary: crisp white, 1px slate border, teal border on hover
      secondary:
        "bg-white text-slate-800 border border-slate-300 hover:border-[#0B7A63] hover:text-[#0B7A63] active:bg-slate-50 shadow-[0_1px_0_rgba(15,23,42,0.04)]",

      // Outline: alias for secondary
      outline:
        "bg-white text-slate-800 border border-slate-300 hover:border-[#0B7A63] hover:text-[#0B7A63] active:bg-slate-50 shadow-[0_1px_0_rgba(15,23,42,0.04)]",

      // Ghost: transparent background, slate hover
      ghost:
        "bg-transparent text-slate-700 border border-transparent hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200",

      // Destructive (solid red: used in confirmation dialogs)
      destructive:
        "bg-rose-700 text-white border-t border-x border-rose-800 border-b-2 border-b-rose-950 hover:bg-rose-600 active:bg-rose-800 active:border-b shadow-[0_1px_2px_rgba(190,18,60,0.2)]",

      // Destructive Outline: white with red border and red text
      "destructive-outline":
        "bg-white text-rose-700 border border-rose-300 hover:bg-rose-50 hover:border-rose-600 active:bg-rose-100 shadow-[0_1px_0_rgba(244,63,94,0.04)]",

      // Warning Outline: white with amber border and amber text (e.g. Reset Password)
      "warning-outline":
        "bg-white text-amber-700 border border-amber-300 hover:bg-amber-50 hover:border-amber-600 active:bg-amber-100 shadow-[0_1px_0_rgba(245,158,11,0.04)]",

      // Link: text button
      link:
        "bg-transparent text-[#0B7A63] hover:underline p-0 h-auto border-0 font-medium shadow-none focus-visible:ring-1 focus-visible:ring-offset-1",

      // Icon: sharp square icon button
      icon:
        "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-[#0B7A63] hover:text-[#0B7A63] active:bg-slate-100 shadow-[0_1px_0_rgba(15,23,42,0.04)]",
    };

    // Strict fixed heights, horizontal padding only, no vertical padding
    const sizeStyles: Record<ButtonSize, string> = {
      sm: "h-[36px] px-3 gap-[6px] text-[14px]",
      md: "h-[44px] px-4 gap-[8px] text-[14px] sm:text-[15px]",
      lg: "h-[48px] px-5 gap-[8px] text-[15px]",
      icon: "h-[40px] w-[40px] p-0 gap-0 text-[14px]",
      "icon-sm": "h-[36px] w-[36px] p-0 gap-0 text-[13px]",
    };

    // Icon sizing: 16px for small, 18px for medium/large
    const iconSizeClasses =
      size === "sm" || size === "icon-sm"
        ? "w-4 h-4 [&_svg]:w-4 [&_svg]:h-4"
        : "w-[18px] h-[18px] [&_svg]:w-[18px] [&_svg]:h-[18px]";

    // Ensure icon-only buttons have accessible label
    const effectiveAriaLabel =
      ariaLabel ||
      (typeof title === "string" ? title : undefined) ||
      (typeof children === "string" ? children : undefined);

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-label={effectiveAriaLabel}
        title={title || (isIconButton && typeof children === "string" ? children : undefined)}
        className={cn(
          baseLayout,
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <span className={cn("btn-icon shrink-0 block flex items-center justify-center pointer-events-none", iconSizeClasses)}>
            <Icons.Spinner className="h-full w-full text-current animate-spin" />
          </span>
        ) : (
          effectiveLeadingIcon && (
            <span className={cn("btn-icon shrink-0 block flex items-center justify-center pointer-events-none", iconSizeClasses)}>
              {effectiveLeadingIcon}
            </span>
          )
        )}

        {children && (
          <span className="btn-label truncate whitespace-nowrap leading-none select-none">
            {children}
          </span>
        )}

        {trailingIcon && !isLoading && (
          <span className={cn("btn-icon-trailing shrink-0 block flex items-center justify-center pointer-events-none", iconSizeClasses)}>
            {trailingIcon}
          </span>
        )}

        {showArrow && !isLoading && (
          <span className={cn("btn-icon-trailing shrink-0 block flex items-center justify-center pointer-events-none transition-transform duration-150 group-hover:translate-x-0.5", iconSizeClasses)}>
            <Icons.ArrowRight className="h-full w-full" />
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
