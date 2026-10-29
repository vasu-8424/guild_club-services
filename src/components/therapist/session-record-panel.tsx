"use client";

import React, { useState } from "react";
import { X, CheckCircle, Clock, AlertCircle, Save, Edit3, ShieldCheck } from "lucide-react";
import { SignaturePad } from "./signature-pad";
import {
  recordDailySessionAction,
  updateTodaySessionAction,
} from "@/lib/actions/therapist-session-new-actions";
import { formatDisplayDate } from "@/lib/date-utils";

export interface SessionRecordCaseData {
  id: string;
  patientId: string;
  clientName: string;
  service: string | null;
  roomNo: string | null;
  presentCondition: string | null;
  todaySession?: {
    id: string;
    notes: string | null;
    presentConditionSnapshot: string | null;
    signatureKey: string | null;
    sessionDate: string;
  } | null;
}

interface SessionRecordPanelProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: SessionRecordCaseData | null;
  todayIST: string;
  onSessionSaved: () => void;
}

export function SessionRecordPanel({
  isOpen,
  onClose,
  caseData,
  todayIST,
  onSessionSaved,
}: SessionRecordPanelProps) {
  const isDoneToday = Boolean(caseData?.todaySession);
  const [isEditing, setIsEditing] = useState(false);

  const [presentCondition, setPresentCondition] = useState(
    caseData?.todaySession?.presentConditionSnapshot ||
      caseData?.presentCondition ||
      ""
  );
  const [sessionNote, setSessionNote] = useState(
    caseData?.todaySession?.notes || ""
  );
  const [signatureBase64, setSignatureBase64] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Sync state when caseData changes
  React.useEffect(() => {
    if (caseData) {
      setPresentCondition(
        caseData.todaySession?.presentConditionSnapshot ||
          caseData.presentCondition ||
          ""
      );
      setSessionNote(caseData.todaySession?.notes || "");
      setSignatureBase64(null);
      setIsEditing(false);
      setErrorMessage(null);
      setFieldErrors({});
    }
  }, [caseData]);

  if (!isOpen || !caseData) return null;

  const isReadOnly = isDoneToday && !isEditing;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});

    // Client-side quick checks
    const errors: Record<string, string> = {};
    if (presentCondition.trim().length < 10) {
      errors.presentCondition = "Present condition today must be at least 10 characters.";
    }
    if (sessionNote.trim().length < 10) {
      errors.note = "Session note must be at least 10 characters.";
    }
    if (!isDoneToday && !signatureBase64) {
      errors.signature = "Patient signature is required every day.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorMessage("Please complete all three required fields.");
      return;
    }

    setSaving(true);
    try {
      if (isDoneToday && caseData.todaySession) {
        // Edit existing session today
        const res = await updateTodaySessionAction({
          caseId: caseData.id,
          sessionId: caseData.todaySession.id,
          note: sessionNote.trim(),
          presentCondition: presentCondition.trim(),
          signatureBase64: signatureBase64 || undefined,
        });

        if (res.success) {
          setIsEditing(false);
          onSessionSaved();
        } else {
          setErrorMessage(res.error || "Failed to update today's session.");
        }
      } else {
        // Record brand new session for today
        const res = await recordDailySessionAction({
          caseId: caseData.id,
          note: sessionNote.trim(),
          presentCondition: presentCondition.trim(),
          signatureBase64: signatureBase64 || "",
        });

        if (res.success) {
          onSessionSaved();
          onClose();
        } else {
          setErrorMessage(res.error || "Failed to record session.");
          if (res.fieldErrors) {
            setFieldErrors(res.fieldErrors);
          }
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "An unexpected error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  const formattedDate = formatDisplayDate(todayIST);

  return (
    <div
      data-testid="session-record-panel"
      className="fixed inset-0 z-50 overflow-hidden bg-stone-900/60 backdrop-blur-xs flex justify-end"
    >
      <div className="w-full sm:max-w-xl md:max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l-2 border-stone-900 overflow-y-auto">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-stone-50 border-b border-stone-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold bg-stone-900 text-white px-2 py-0.5">
                {caseData.patientId}
              </span>
              <span className="text-sm font-bold text-stone-900 tracking-tight">
                {caseData.clientName}
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-1">
              {isDoneToday
                ? `Today's Saved Session • ${formattedDate}`
                : `Record Today's Session • ${formattedDate}`}
            </p>
          </div>

          <button
            type="button"
            data-testid="close-session-panel-btn"
            onClick={onClose}
            className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Banner */}
        <div className="px-6 py-3 border-b border-stone-200">
          {isDoneToday ? (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-300 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Today&apos;s session is recorded and complete.</span>
              </div>
              <p className="text-[11px] text-emerald-700">
                Can be edited until midnight IST.
              </p>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-300 p-3 flex items-start gap-2 text-xs font-medium text-red-900">
              <Clock className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Session Pending for Today ({formattedDate})</p>
                <p className="text-[11px] text-red-700 mt-0.5">
                  All 3 items (condition, session note, and patient signature) are required to mark this session Done.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-300 text-red-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Item A: Present Condition Today */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="present-condition-input"
                className="text-xs font-bold uppercase tracking-wider text-stone-900"
              >
                1. Present Condition Today <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] text-stone-500">Min 10 characters</span>
            </div>
            {isReadOnly ? (
              <div className="p-3 bg-stone-50 border border-stone-200 text-xs font-sans text-stone-800 whitespace-pre-wrap leading-relaxed min-h-[70px]">
                {caseData.todaySession?.presentConditionSnapshot || caseData.presentCondition || "—"}
              </div>
            ) : (
              <textarea
                id="present-condition-input"
                data-testid="present-condition-input"
                rows={3}
                value={presentCondition}
                onChange={(e) => setPresentCondition(e.target.value)}
                placeholder="Describe patient's present condition today (e.g., Mobility improved, reports pain level 3/10)..."
                className="w-full text-xs font-sans p-3 border-2 border-stone-800 rounded-none focus:outline-hidden focus:ring-2 focus:ring-[#0B7A63] leading-relaxed"
              />
            )}
            {fieldErrors.presentCondition && (
              <p className="text-[11px] text-red-600 font-medium">
                {fieldErrors.presentCondition}
              </p>
            )}
          </div>

          {/* Item B: Session Note */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="session-note-input"
                className="text-xs font-bold uppercase tracking-wider text-stone-900"
              >
                2. Session Note <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] text-stone-500">Min 10 characters</span>
            </div>
            {isReadOnly ? (
              <div className="p-3 bg-stone-50 border border-stone-200 text-xs font-sans text-stone-800 whitespace-pre-wrap leading-relaxed min-h-[90px]">
                {caseData.todaySession?.notes || "—"}
              </div>
            ) : (
              <textarea
                id="session-note-input"
                data-testid="session-note-input"
                rows={4}
                value={sessionNote}
                onChange={(e) => setSessionNote(e.target.value)}
                placeholder="Enter clinical observations, exercises completed, response to treatment..."
                className="w-full text-xs font-sans p-3 border-2 border-stone-800 rounded-none focus:outline-hidden focus:ring-2 focus:ring-[#0B7A63] leading-relaxed"
              />
            )}
            {fieldErrors.note && (
              <p className="text-[11px] text-red-600 font-medium">
                {fieldErrors.note}
              </p>
            )}
          </div>

          {/* Item C: Patient Signature */}
          <div className="space-y-1.5">
            {isReadOnly ? (
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-900 block">
                  3. Patient Signature
                </span>
                <div className="p-3 bg-stone-50 border border-stone-200 flex items-center justify-center min-h-[120px]">
                  {caseData.todaySession?.id ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={`/api/files/${caseData.todaySession.id}/signature`}
                      alt="Patient Signature"
                      className="max-h-[100px] object-contain border border-stone-300 bg-white p-1"
                    />
                  ) : (
                    <span className="text-xs text-stone-400">Signature on file</span>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <SignaturePad
                  onChange={(dataUrl) => setSignatureBase64(dataUrl)}
                  initialSignatureUrl={
                    caseData.todaySession?.id
                      ? `/api/files/${caseData.todaySession.id}/signature`
                      : undefined
                  }
                />
                {fieldErrors.signature && (
                  <p className="text-[11px] text-red-600 font-medium mt-1">
                    {fieldErrors.signature}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Drawer Actions */}
          <div className="pt-4 border-t border-stone-200 flex items-center justify-between gap-3">
            {isReadOnly ? (
              <button
                type="button"
                data-testid="edit-session-btn"
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-stone-900 text-white font-bold text-xs uppercase tracking-wider rounded-none hover:bg-stone-800 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Today&apos;s Record</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 w-full justify-end">
                {isDoneToday && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 border border-stone-300 text-stone-700 text-xs font-semibold uppercase tracking-wider hover:bg-stone-100 rounded-none cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  data-testid="save-session-btn"
                  disabled={saving}
                  className="px-5 py-2.5 bg-[#0B7A63] hover:bg-[#086350] disabled:bg-stone-400 text-white font-bold text-xs uppercase tracking-wider rounded-none transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? "Saving..." : "Save session"}</span>
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
