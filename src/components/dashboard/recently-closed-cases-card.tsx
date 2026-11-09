"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Icons } from "@/components/ui/icons";
import { OutcomeTag } from "@/components/notifications/outcome-tag";

export interface ClosedCaseItem {
  id: string;
  caseNumber: string;
  patientId?: string;
  patientName?: string;
  outcome: string;
  closedAtIst?: string | null;
  closedTime?: string | null;
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
    <Card data-testid="recently-closed-cases-card" className={`rounded-none border-slate-200 shadow-sm ${className}`}>
      <CardHeader className="flex flex-row items-start justify-between pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-none bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
              <Icons.Check className="h-3.5 w-3.5" />
            </div>
            <CardTitle className="text-base font-bold text-slate-900 tracking-tight">
              Recently Closed Cases
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-500 mt-1">
            Cases closed on the selected date for this branch.
          </CardDescription>
        </div>

        <Link
          href={`${basePath}/cases?status=completed`}
          className="text-xs font-semibold text-[#0B7A63] hover:text-[#096350] hover:underline shrink-0"
        >
          View all &rarr;
        </Link>
      </CardHeader>

      <CardContent className="pt-2 px-0">
        {cases.length === 0 ? (
          <div
            data-testid="no-closed-cases-message"
            className="p-8 text-center text-xs text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-none m-4"
          >
            No cases were closed on this date
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {cases.map((item) => (
              <div
                key={item.id}
                data-testid={`recently-closed-row-${item.id}`}
                className="py-3.5 px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/70 transition-colors"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      data-testid={`closed-patient-id-${item.id}`}
                      className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 border border-slate-200"
                    >
                      {item.patientId || item.caseNumber}
                    </span>
                    <span
                      data-testid={`closed-patient-name-${item.id}`}
                      className="text-sm font-semibold text-slate-900 truncate"
                    >
                      {item.patientName || "Patient"}
                    </span>
                    <OutcomeTag outcome={item.outcome} size="sm" />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span data-testid={`closed-therapist-${item.id}`}>
                      Therapist: <strong className="text-slate-700 font-medium">{item.therapistName}</strong>
                    </span>
                    {(item.closedTime || item.closedAtIst) && (
                      <>
                        <span className="text-slate-300">&bull;</span>
                        <span data-testid={`closed-time-${item.id}`}>
                          Closed at: <strong className="text-slate-700 font-medium">{item.closedTime || item.closedAtIst}</strong>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <Link
                  href={`${basePath}/cases/${item.id}`}
                  data-testid={`view-closed-case-${item.id}`}
                  className="text-xs font-semibold text-[#0B7A63] hover:underline shrink-0 self-start sm:self-center"
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
