"use client";

import React from "react";
import Link from "next/link";
import { Clock, CheckCircle2, ArrowRight, DoorClosed, Stethoscope, AlertTriangle } from "lucide-react";
import { getServiceLabel } from "@/lib/services";

export interface CaseTileData {
  id: string;
  patientId: string;
  clientName: string;
  service: string | null;
  category: string | null;
  roomNo: string | null;
  status: string;
  presentCondition: string | null;
  todaySession?: {
    id: string;
    notes: string | null;
    presentConditionSnapshot: string | null;
    signatureKey: string | null;
    sessionDate: string;
  } | null;
}

interface CaseTileProps {
  caseItem: CaseTileData;
  onTileClick: (caseItem: CaseTileData) => void;
}

function CaseTileComponent({ caseItem, onTileClick }: CaseTileProps) {
  const session = caseItem.todaySession;

  // Verify all 3 items saved on the server
  const hasCondition = Boolean(
    session?.presentConditionSnapshot && session.presentConditionSnapshot.trim().length >= 10
  );
  const hasNote = Boolean(
    session?.notes && session.notes.trim().length >= 10
  );
  const hasSignature = Boolean(session?.signatureKey);

  const isDone = hasCondition && hasNote && hasSignature;

  // Determine what items are missing
  const missingItems: string[] = [];
  if (!hasCondition) missingItems.push("Condition missing");
  if (!hasNote) missingItems.push("Note missing");
  if (!hasSignature) missingItems.push("Signature missing");

  const serviceLabel = caseItem.service
    ? getServiceLabel(caseItem.service)
    : caseItem.category
    ? caseItem.category
    : "General";

  return (
    <div
      data-testid="case-tile"
      data-case-id={caseItem.id}
      data-status={isDone ? "done" : "pending"}
      onClick={() => onTileClick(caseItem)}
      className={`group relative p-4 flex flex-col justify-between transition-all cursor-pointer rounded-none border-2 shadow-xs select-none ${
        isDone
          ? "border-emerald-600 bg-emerald-50/20 hover:border-emerald-700 hover:bg-emerald-50/40"
          : "border-red-500 bg-red-50/15 hover:border-red-600 hover:bg-red-50/30"
      }`}
    >
      {/* Top Header: Patient ID & Today's Status Badge */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span
            data-testid="patient-id"
            className="font-mono text-xs font-bold px-2 py-0.5 bg-stone-900 text-white tracking-wide"
          >
            {caseItem.patientId}
          </span>

          {isDone ? (
            <span
              data-testid="status-done-badge"
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold bg-emerald-600 text-white uppercase tracking-wider"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Done</span>
            </span>
          ) : (
            <span
              data-testid="status-pending-badge"
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold bg-red-600 text-white uppercase tracking-wider animate-pulse"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Pending</span>
            </span>
          )}
        </div>

        {/* Patient Name - clicking navigates to case detail page */}
        <h3 className="text-sm font-bold text-stone-900 tracking-tight group-hover:text-[#0B7A63] transition-colors mb-2">
          <Link
            href={`/therapist/cases/${caseItem.id}`}
            onClick={(e) => e.stopPropagation()}
            data-testid="patient-name"
            className="hover:underline"
          >
            {caseItem.clientName}
          </Link>
        </h3>

        {/* Tags: Service & Room */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <span
            data-testid="service-tag"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold bg-stone-100 text-stone-700 border border-stone-200"
          >
            <Stethoscope className="w-3 h-3 text-stone-500" />
            <span className="truncate max-w-[120px]">{serviceLabel}</span>
          </span>

          {caseItem.roomNo && (
            <span
              data-testid="room-tag"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-stone-100 text-stone-700 border border-stone-200"
            >
              <DoorClosed className="w-3 h-3 text-stone-500" />
              <span>Room {caseItem.roomNo}</span>
            </span>
          )}
        </div>

        {/* Missing items indicators for Pending tile */}
        {!isDone && missingItems.length > 0 && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 text-[11px] text-red-800 space-y-1">
            <div className="flex items-center gap-1 font-bold text-red-900 uppercase text-[10px]">
              <AlertTriangle className="w-3 h-3 text-red-600" />
              <span>Missing for today:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] pl-0.5 font-medium">
              {missingItems.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {/* If done, show brief confirmation */}
        {isDone && (
          <div className="mb-3 p-2 bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="font-medium">Condition, note & signature recorded.</span>
          </div>
        )}
      </div>

      {/* Tile Footer / Open Case link */}
      <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-xs">
        <span className="text-[11px] font-medium text-stone-500">
          {isDone ? "Tap to view/edit" : "Tap to record"}
        </span>

        <Link
          href={`/therapist/cases/${caseItem.id}`}
          onClick={(e) => e.stopPropagation()}
          data-testid="open-case-link"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0B7A63] hover:underline"
        >
          <span>Open case</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

export const CaseTile = React.memo(CaseTileComponent);
