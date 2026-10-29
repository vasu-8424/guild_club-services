"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Users, CheckCircle2, Clock, Calendar as CalendarIcon, MapPin } from "lucide-react";
import { CaseTile, type CaseTileData } from "./case-tile";
import { SessionRecordPanel } from "./session-record-panel";
import { formatDisplayDate } from "@/lib/date-utils";

interface DailyBoardViewProps {
  casesList: CaseTileData[];
  branchName: string;
  todayIST: string;
}

export function DailyBoardView({
  casesList,
  branchName,
  todayIST,
}: DailyBoardViewProps) {
  const router = useRouter();
  const [selectedCase, setSelectedCase] = useState<CaseTileData | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  // Compute summary numbers
  const { doneCount, pendingCount, activeCount } = useMemo(() => {
    let done = 0;
    casesList.forEach((c) => {
      const s = c.todaySession;
      const isComplete = Boolean(
        s?.presentConditionSnapshot &&
          s.presentConditionSnapshot.trim().length >= 10 &&
          s?.notes &&
          s.notes.trim().length >= 10 &&
          s?.signatureKey
      );
      if (isComplete) {
        done++;
      }
    });

    const pending = casesList.length - done;
    return {
      activeCount: casesList.length,
      doneCount: done,
      pendingCount: pending,
    };
  }, [casesList]);

  // Sort tiles: Pending first, then Patient ID
  const sortedCases = useMemo(() => {
    return [...casesList].sort((a, b) => {
      const aDone = Boolean(
        a.todaySession?.presentConditionSnapshot &&
          a.todaySession.presentConditionSnapshot.trim().length >= 10 &&
          a.todaySession?.notes &&
          a.todaySession.notes.trim().length >= 10 &&
          a.todaySession?.signatureKey
      );
      const bDone = Boolean(
        b.todaySession?.presentConditionSnapshot &&
          b.todaySession.presentConditionSnapshot.trim().length >= 10 &&
          b.todaySession?.notes &&
          b.todaySession.notes.trim().length >= 10 &&
          b.todaySession?.signatureKey
      );

      // Pending (false) comes before Done (true)
      if (aDone !== bDone) {
        return aDone ? 1 : -1;
      }

      // Then by Patient ID ascending (e.g. GCP-0001, GCP-0002)
      return (a.patientId || "").localeCompare(b.patientId || "");
    });
  }, [casesList]);

  const handleTileClick = (caseItem: CaseTileData) => {
    setSelectedCase(caseItem);
    setPanelOpen(true);
  };

  const handleSessionSaved = () => {
    router.refresh();
  };

  const formattedDate = formatDisplayDate(todayIST);

  return (
    <div data-testid="daily-board" className="space-y-6">
      {/* Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black text-stone-900 uppercase tracking-tight">
              Today&apos;s Sessions
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-stone-100 border border-stone-300 text-stone-800 text-xs font-bold rounded-none">
              <MapPin className="w-3.5 h-3.5 text-[#0B7A63]" />
              <span>{branchName}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 mt-1.5 text-xs font-semibold text-stone-600">
            <CalendarIcon className="w-3.5 h-3.5 text-[#0B7A63]" />
            <span data-testid="today-date-ist">{formattedDate} (IST)</span>
          </div>
        </div>

        <div>
          <Link
            href="/therapist/cases/new"
            data-testid="create-case-btn"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0B7A63] hover:bg-[#086350] text-white text-xs font-bold uppercase tracking-wider rounded-none shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Case</span>
          </Link>
        </div>
      </div>

      {/* Summary Strip (3 Plain Numbers) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Active patients */}
        <div data-testid="summary-active" className="bg-white border-2 border-stone-800 p-4 rounded-none shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Active patients
            </span>
            <Users className="w-4 h-4 text-stone-400" />
          </div>
          <p
            data-testid="summary-active-patients"
            className="text-3xl font-black text-stone-900 mt-2"
          >
            {activeCount}
          </p>
        </div>

        {/* Done today */}
        <div data-testid="summary-done" className="bg-white border-2 border-emerald-600 p-4 rounded-none shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Done today
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p
            data-testid="summary-done-today"
            className="text-3xl font-black text-emerald-700 mt-2"
          >
            {doneCount}
          </p>
        </div>

        {/* Pending today */}
        <div data-testid="summary-pending" className="bg-white border-2 border-red-500 p-4 rounded-none shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-red-700">
              Pending today
            </span>
            <Clock className="w-4 h-4 text-red-500" />
          </div>
          <p
            data-testid="summary-pending-today"
            className="text-3xl font-black text-red-600 mt-2"
          >
            {pendingCount}
          </p>
        </div>
      </div>

      {/* Cases Tile Grid: 4 cols desktop, 2 tablet, 1 mobile */}
      {sortedCases.length === 0 ? (
        <div
          data-testid="empty-board-state"
          className="bg-white border-2 border-dashed border-stone-300 p-12 text-center rounded-none my-8"
        >
          <div className="max-w-md mx-auto space-y-3">
            <p className="text-sm font-bold text-stone-800 uppercase tracking-wide">
              No active patients. Create your first case.
            </p>
            <p className="text-xs text-stone-500">
              Active cases assigned to you at {branchName} will appear here as daily session tiles.
            </p>
            <div className="pt-2">
              <Link
                href="/therapist/cases/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#0B7A63] text-white text-xs font-bold uppercase tracking-wider rounded-none hover:bg-[#086350] transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>+ Create Case</span>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-stone-500 px-1">
            <span>
              Showing {sortedCases.length} case tile{sortedCases.length === 1 ? "" : "s"} (Sorted: Pending first, then Patient ID)
            </span>
            <span>Every calendar day counts. Tiles reset at midnight IST.</span>
          </div>

          <div
            data-testid="daily-board-grid"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-h-[75vh] overflow-y-auto pr-1"
          >
            {sortedCases.map((caseItem) => (
              <CaseTile
                key={caseItem.id}
                caseItem={caseItem}
                onTileClick={handleTileClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* Slide-out Session Drawer */}
      <SessionRecordPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        caseData={selectedCase}
        todayIST={todayIST}
        onSessionSaved={handleSessionSaved}
      />
    </div>
  );
}
