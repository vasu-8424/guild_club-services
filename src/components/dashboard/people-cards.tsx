"use client";

import * as React from "react";
import { Icons } from "@/components/ui/icons";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import type { PersonActivitySummary } from "@/lib/dashboard";

interface PeopleCardsProps {
  people: PersonActivitySummary[];
  onSelectPerson: (person: PersonActivitySummary) => void;
}

export function PeopleCards({ people, onSelectPerson }: PeopleCardsProps) {
  const [activeTab, setActiveTab] = React.useState<"all" | "admin" | "therapist">("all");

  const admins = people.filter((p) => p.role === "admin");
  const therapists = people.filter((p) => p.role === "therapist");

  const displayed =
    activeTab === "all" ? people : activeTab === "admin" ? admins : therapists;

  return (
    <div className="space-y-4">
      {/* Header & Role Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Icons.Analytics className="h-4 w-4 text-[#0B7A63]" />
            <span>Staff Activity Summary</span>
          </h3>
          <p className="text-xs text-slate-500">
            Work performed by clinic administrators and clinical therapists during this timeframe. Click any card to inspect timestamped logs.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-none bg-slate-100 p-0.5 text-xs font-semibold border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`rounded-none px-2.5 py-1 transition-colors ${
              activeTab === "all"
                ? "bg-[#0B7A63] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All Staff ({people.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("admin")}
            className={`rounded-none px-2.5 py-1 transition-colors ${
              activeTab === "admin"
                ? "bg-[#0B7A63] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Admins ({admins.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("therapist")}
            className={`rounded-none px-2.5 py-1 transition-colors ${
              activeTab === "therapist"
                ? "bg-[#0B7A63] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Therapists ({therapists.length})
          </button>
        </div>
      </div>

      {/* Grid of Person Cards */}
      {displayed.length === 0 ? (
        <div className="rounded-none border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center text-slate-400">
          <Icons.UserSingle className="h-8 w-8 mx-auto mb-2 text-slate-300" />
          <p className="text-xs font-semibold text-slate-700">
            No staff activity recorded
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            No actions were performed by {activeTab === "all" ? "any staff member" : activeTab === "admin" ? "administrators" : "therapists"} during this timeframe.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayed.map((p) => {
            const isAdmin = p.role === "admin";
            return (
              <div
                key={p.actorId}
                data-testid={`person-card-${p.actorId}`}
                onClick={() => onSelectPerson(p)}
                className="group relative cursor-pointer rounded-none border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)] hover:border-[#0B7A63] transition-all flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar
                        name={p.name}
                        size="sm"
                        variant={isAdmin ? "indigo" : "brand"}
                      />
                      <div>
                        <h4 className="text-xs font-semibold text-slate-900 group-hover:text-[#0B7A63] transition-colors">
                          {p.name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge
                            variant={isAdmin ? "role_admin" : "role_therapist"}
                            className="text-[10px] py-0 px-1.5"
                          >
                            {p.role}
                          </Badge>
                          {p.specialization && (
                            <span className="text-[10px] text-slate-500 truncate max-w-[120px]">
                              {p.specialization}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <span className="rounded-[2px] bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200 shrink-0 tabular-nums">
                      {p.totalActions} action{p.totalActions !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Narrative Summary Text */}
                  <div className="mt-3 rounded-none bg-slate-50 p-2.5 border border-slate-100">
                    <p className="text-xs font-medium text-slate-800 leading-normal">
                      {p.narrativeText}
                    </p>
                  </div>
                </div>

                {/* Card Footer Breakdown pills */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {isAdmin ? (
                      <>
                        {p.breakdown.casesCreated > 0 && (
                          <span className="rounded-[2px] bg-sky-50 px-1.5 py-0.2 font-semibold text-sky-800 border border-sky-200">
                            Created: {p.breakdown.casesCreated}
                          </span>
                        )}
                        {p.breakdown.casesAssigned > 0 && (
                          <span className="rounded-[2px] bg-indigo-50 px-1.5 py-0.2 font-semibold text-indigo-800 border border-indigo-200">
                            Assigned: {p.breakdown.casesAssigned}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        {p.breakdown.sessionsHeld > 0 && (
                          <span className="rounded-[2px] bg-emerald-50 px-1.5 py-0.2 font-semibold text-emerald-800 border border-emerald-200">
                            Sessions: {p.breakdown.sessionsHeld}
                          </span>
                        )}
                        {p.breakdown.notesAdded > 0 && (
                          <span className="rounded-[2px] bg-indigo-50 px-1.5 py-0.2 font-semibold text-indigo-800 border border-indigo-200">
                            Notes: {p.breakdown.notesAdded}
                          </span>
                        )}
                        {p.breakdown.casesClosed > 0 && (
                          <span className="rounded-[2px] bg-slate-100 px-1.5 py-0.2 font-semibold text-slate-800 border border-slate-200">
                            Closed: {p.breakdown.casesClosed}
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  <span className="opacity-0 group-hover:opacity-100 transition-opacity font-semibold text-[#0B7A63] flex items-center gap-0.5 shrink-0">
                    <span>Logs</span>
                    <Icons.ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
