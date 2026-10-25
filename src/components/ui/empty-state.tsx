"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "./button";
import { Icons } from "./icons";

interface EmptyStateProps {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  icon?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
  icon,
}: EmptyStateProps) {
  return (
    <div data-testid="empty-state" className="flex flex-col items-center justify-center rounded-none border border-dashed border-slate-300 bg-slate-50/50 p-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-none border border-slate-200 bg-white text-slate-400 mb-3.5 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        {icon || <Icons.Analytics className="h-6 w-6" />}
      </div>
      <h3 className="text-base font-semibold text-slate-900 tracking-tight">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 max-w-sm leading-normal">{description}</p>
      {actionHref && actionLabel && (
        <div className="mt-5">
          <Link href={actionHref}>
            <Button size="sm">{actionLabel}</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
