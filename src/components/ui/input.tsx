import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  "data-testid"?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", label, error, helperText, id, autoCapitalize, autoComplete, lang, spellCheck, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    // Compute automatic defaults based on input type and field name
    const isName = /name/i.test(label || "") || /name/i.test(props.name || "") || props["data-testid"]?.includes("name");
    const isEmail = type === "email" || /email/i.test(label || "") || props["data-testid"]?.includes("email");
    const isPhone = type === "tel" || /phone/i.test(label || "") || props["data-testid"]?.includes("phone");
    const isPassword = type === "password";

    const resolvedAutoCapitalize =
      autoCapitalize !== undefined
        ? autoCapitalize
        : isName
        ? "words"
        : isEmail || isPassword
        ? "none"
        : "sentences";

    const resolvedAutoComplete =
      autoComplete !== undefined
        ? autoComplete
        : isName
        ? "name"
        : isEmail
        ? "email"
        : isPhone
        ? "tel"
        : isPassword
        ? "current-password"
        : "off";

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            id={inputId}
            type={type}
            ref={ref}
            lang={lang || "en-IN"}
            spellCheck={spellCheck !== undefined ? spellCheck : !isPassword && !isEmail}
            autoCapitalize={resolvedAutoCapitalize}
            autoComplete={resolvedAutoComplete}
            className={cn(
              "w-full rounded-none border border-slate-300 bg-white px-3.5 py-2.5 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 transition-colors shadow-[0_1px_0_rgba(15,23,42,0.04)] hover:border-slate-400 focus:border-[#0B7A63] focus:outline-none focus:ring-1 focus:ring-[#0B7A63] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500",
              error && "border-rose-500 focus:border-rose-600 focus:ring-rose-500/20",
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p
            data-testid={props["data-testid"] ? `${props["data-testid"]}-error` : undefined}
            className="text-xs text-rose-600 font-medium"
          >
            {error}
          </p>
        )}
        {helperText && !error && (
          <p className="text-xs text-slate-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
