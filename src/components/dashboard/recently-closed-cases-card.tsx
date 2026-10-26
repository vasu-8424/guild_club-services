"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Icons } from "@/components/ui/icons";
import { OutcomeTag } from "@/components/notifications/outcome-tag";

export interface ClosedCaseItem {
  id: string;
  caseNumber: string;
  outcome: string;
  closedAtIst: string | null;
  therapistName: string;
}

interface RecentlyClosedCasesCardProps {
  cases: ClosedCaseItem[];
  userRole?: string;
  className?: string;
}

export function RecentlyClosedCasesCard({
  cases,
  userRole = "admin",
  className = "",
}: RecentlyClosedCasesCardProps) {
  const basePath = userRole === "super_admin" ? "/super-admin" : "/admin";

  return (
    <Card data-testid="recently-closed-cases-card" className={`rounded-none ${className}`}>
      <CardHeader className="flex flex-row items-start justify-between pb-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-none bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
              <Icons.Check className="h-3.5 w-3.5" />
            </div>
            <CardTitle className="text-sm font-bold text-slate-900 tracking-tight">
              Recently Closed Cases
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-500 mt-1">
            Cases recently finalized with clinical outcome and documentation.
          </CardDescription>
        </div>

        <Link
          href={`${basePath}/cases?status=completed`}
          className="text-xs font-semibold text-[#0B7A63] hover:text-[#096350] hover:underline shrink-0"
        >
          View all &rarr;
        </Link>
      </CardHeader>

      <CardContent className="pt-0">
        {cases.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-none">
            No closed cases recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {cases.slice(0, 5).map((item) => (
              <div
                key={item.id}
                data-testid={`recently-closed-row-${item.id}`}
                className="py-3 flex items-center justify-between gap-3 group hover:bg-slate-50/50 px-2 -mx-2 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 font-mono tracking-tight">
                      {item.caseNumber}
                    </span>
                    <OutcomeTag outcome={item.outcome} size="sm" />
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                    <span>
                      by <strong className="text-slate-700 font-medium">{item.therapistName}</strong>
                    </span>
                    {item.closedAtIst && (
                      <>
                        <span>&bull;</span>
                        <span>{item.closedAtIst}</span>
                      </>
                    )}
                  </div>
                </div>

                <Link
                  href={`${basePath}/cases/${item.id}`}
                  data-testid={`view-closed-case-${item.id}`}
                  className="text-xs font-semibold text-slate-500 group-hover:text-[#0B7A63] underline shrink-0"
                >
                  View case &rarr;
                </Link>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
