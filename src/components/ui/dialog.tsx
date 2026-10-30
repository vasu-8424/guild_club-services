"use client";

import * as React from "react";
import { Icons } from "./icons";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
        onClick={() => onOpenChange?.(false)}
      />
      {children}
    </div>
  );
}

interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
}

export function DialogContent({
  children,
  className = "sm:max-w-md",
  onClose,
}: DialogContentProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className={cn(
        "relative z-50 w-full max-h-[min(90dvh,calc(100dvh-2rem))] overflow-y-auto rounded-none bg-white p-5 sm:p-6 shadow-[0_12px_32px_rgba(15,23,42,0.16)] border border-slate-300 border-t-2 border-t-[#0B7A63] transition-all",
        className
      )}
    >
      {onClose && (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={onClose}
          className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 min-h-[36px] min-w-[36px]"
          aria-label="Close dialog"
        >
          <Icons.Close className="h-4 w-4" />
        </Button>
      )}
      {children}
    </div>
  );
}

export function DialogHeader({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-col space-y-1.5 text-left pr-8", className)}>{children}</div>;
}

export function DialogTitle({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <h3 className={cn("text-[17px] font-semibold leading-tight tracking-tight text-slate-900", className)}>{children}</h3>;
}

export function DialogDescription({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={cn("text-[13px] text-slate-500 leading-normal", className)}>{children}</p>;
}

export function DialogFooter({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4 border-t border-slate-100 mt-5", className)}>
      {children}
    </div>
  );
}
