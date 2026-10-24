"use client";

import * as React from "react";
import { Icons } from "@/components/ui/icons";

const X = Icons.Close;
const Camera = Icons.Camera;
const Check = Icons.Check;
const Clock = Icons.Clock;
const AlertCircle = Icons.Alert;
const Save = Icons.Check;
const CheckCircle2 = Icons.Success;
const User = Icons.UserSingle;
const Calendar = Icons.Calendar;
const MapPin = Icons.Room;
const ShieldCheck = Icons.Security;
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PatientSignaturePad } from "./patient-signature-pad";
import {
  saveCheckInAction,
  saveWorkDoneAction,
  saveCheckOutAction,
  saveSignatureAction,
  completeSessionAction,
} from "@/lib/actions/therapist-session-actions";
import { formatTimeIST, formatDateTimeIST } from "@/lib/date-utils";

// Configurable photo consent default
export const DEFAULT_PHOTO_CONSENT = true;

export interface TherapistSessionItem {
  id: string;
  caseId: string;
  scheduledAt: Date;
  status: "scheduled" | "held" | "missed" | "cancelled";
  notes: string | null;
  inTimeAt: Date | null;
  inTimePhotoKey: string | null;
  outTimeAt: Date | null;
  outTimePhotoKey: string | null;
  workDone: string | null;
  patientSignatureKey: string | null;
  photoConsent: boolean | null;
  completedAt: Date | null;
  caseNumber: string;
  patientName: string;
  patientAge: number;
}

interface SessionDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  session: TherapistSessionItem | null;
  roomNo: string;
  isToday: boolean;
  onSessionUpdated: (updated: TherapistSessionItem) => void;
}

export function SessionDetailDrawer({
  isOpen,
  onClose,
  session,
  roomNo,
  isToday,
  onSessionUpdated,
}: SessionDetailDrawerProps) {
  // Local editable states
  const [inTimePhotoUrl, setInTimePhotoUrl] = React.useState<string | null>(null);
  const [inTimeAt, setInTimeAt] = React.useState<Date | null>(null);
  const [inTimeLoading, setInTimeLoading] = React.useState(false);

  const [workDone, setWorkDone] = React.useState("");
  const [workDoneSaved, setWorkDoneSaved] = React.useState(false);
  const [workDoneLoading, setWorkDoneLoading] = React.useState(false);

  const [outTimePhotoUrl, setOutTimePhotoUrl] = React.useState<string | null>(null);
  const [outTimeAt, setOutTimeAt] = React.useState<Date | null>(null);
  const [outTimeLoading, setOutTimeLoading] = React.useState(false);

  const [signatureDataUrl, setSignatureDataUrl] = React.useState<string | null>(null);
  const [signatureLoading, setSignatureLoading] = React.useState(false);

  const [photoConsent, setPhotoConsent] = React.useState(DEFAULT_PHOTO_CONSENT);
  const [completeLoading, setCompleteLoading] = React.useState(false);

  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successToast, setSuccessToast] = React.useState<string | null>(null);

  const inFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const outFileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Sync state when session opens
  React.useEffect(() => {
    if (session) {
      setInTimeAt(session.inTimeAt ? new Date(session.inTimeAt) : null);
      setInTimePhotoUrl(
        session.inTimePhotoKey
          ? `/api/files/${session.id}/in-time-photo?t=${new Date().getTime()}`
          : null
      );

      setWorkDone(session.workDone || "");
      setWorkDoneSaved(Boolean(session.workDone && session.workDone.trim().length >= 10));

      setOutTimeAt(session.outTimeAt ? new Date(session.outTimeAt) : null);
      setOutTimePhotoUrl(
        session.outTimePhotoKey
          ? `/api/files/${session.id}/out-time-photo?t=${new Date().getTime()}`
          : null
      );

      setSignatureDataUrl(
        session.patientSignatureKey
          ? `/api/files/${session.id}/signature?t=${new Date().getTime()}`
          : null
      );

      setPhotoConsent(session.photoConsent ?? DEFAULT_PHOTO_CONSENT);
      setErrorMessage(null);
      setSuccessToast(null);
    }
  }, [session]);

  if (!isOpen || !session) return null;

  const isCompleted = session.status === "held";
  const isReadOnly = isCompleted || !isToday;

  // Compress photo on client to max 1600px
  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const maxDim = 1600;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressed = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
                type: "image/jpeg",
              });
              resolve(compressed);
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          0.85
        );
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  };

  // 1. In-time photo handler
  const handleInTimeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setInTimeLoading(true);
    setErrorMessage(null);

    try {
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append("sessionId", session.id);
      formData.append("photo", compressed);
      formData.append("photoConsent", photoConsent ? "true" : "false");

      const res = await saveCheckInAction(formData);
      if (!res.success) {
        setErrorMessage(res.error || "Failed to save in-time photo.");
      } else {
        const stampedTime = new Date(res.data!.inTimeAt);
        setInTimeAt(stampedTime);
        setInTimePhotoUrl(`/api/files/${session.id}/in-time-photo?t=${new Date().getTime()}`);
        onSessionUpdated({
          ...session,
          inTimeAt: stampedTime,
          inTimePhotoKey: res.data!.photoKey,
          photoConsent,
        });
      }
    } catch {
      setErrorMessage("Upload failed. Please check image format and size.");
    } finally {
      setInTimeLoading(false);
    }
  };

  // 2. Save Work Done Draft
  const handleSaveWorkDone = async () => {
    if (!workDone.trim()) {
      setErrorMessage("Please enter work done details.");
      return;
    }

    setWorkDoneLoading(true);
    setErrorMessage(null);

    try {
      const res = await saveWorkDoneAction({
        sessionId: session.id,
        workDone: workDone.trim(),
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to save work done notes.");
      } else {
        setWorkDoneSaved(true);
        onSessionUpdated({
          ...session,
          workDone: workDone.trim(),
        });
      }
    } catch {
      setErrorMessage("Error saving notes. Please try again.");
    } finally {
      setWorkDoneLoading(false);
    }
  };

  // 3. Out-time photo handler
  const handleOutTimeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOutTimeLoading(true);
    setErrorMessage(null);

    try {
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append("sessionId", session.id);
      formData.append("photo", compressed);

      const res = await saveCheckOutAction(formData);
      if (!res.success) {
        setErrorMessage(res.error || "Failed to save out-time photo.");
      } else {
        const stampedTime = new Date(res.data!.outTimeAt);
        setOutTimeAt(stampedTime);
        setOutTimePhotoUrl(`/api/files/${session.id}/out-time-photo?t=${new Date().getTime()}`);
        onSessionUpdated({
          ...session,
          outTimeAt: stampedTime,
          outTimePhotoKey: res.data!.photoKey,
        });
      }
    } catch {
      setErrorMessage("Upload failed. Please check image format and size.");
    } finally {
      setOutTimeLoading(false);
    }
  };

  // 4. Save Signature handler
  const handleSignatureChange = async (dataUrl: string | null) => {
    setSignatureDataUrl(dataUrl);
    if (!dataUrl) return;

    setSignatureLoading(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("sessionId", session.id);
      formData.append("signatureDataUrl", dataUrl);

      const res = await saveSignatureAction(formData);
      if (!res.success) {
        setErrorMessage(res.error || "Failed to save signature.");
      } else {
        onSessionUpdated({
          ...session,
          patientSignatureKey: res.data!.signatureKey,
        });
      }
    } catch {
      setErrorMessage("Error saving signature.");
    } finally {
      setSignatureLoading(false);
    }
  };

  // 5. Complete Session
  const canComplete =
    Boolean(inTimePhotoUrl && inTimeAt) &&
    Boolean(workDone.trim().length >= 10) &&
    Boolean(outTimePhotoUrl && outTimeAt) &&
    Boolean(signatureDataUrl) &&
    !isReadOnly;

  const handleCompleteSession = async () => {
    if (!canComplete) return;

    setCompleteLoading(true);
    setErrorMessage(null);

    try {
      // First ensure work done is saved if typed
      if (workDone.trim() !== (session.workDone || "")) {
        await saveWorkDoneAction({
          sessionId: session.id,
          workDone: workDone.trim(),
        });
      }

      const res = await completeSessionAction({ sessionId: session.id });
      if (!res.success) {
        setErrorMessage(res.error || "Failed to complete session.");
      } else {
        setSuccessToast("Session completed successfully!");
        const updatedSession: TherapistSessionItem = {
          ...session,
          status: "held",
          completedAt: new Date(res.data!.completedAt),
          workDone: workDone.trim(),
        };
        onSessionUpdated(updatedSession);
        setTimeout(() => {
          onClose();
        }, 800);
      }
    } catch {
      setErrorMessage("An unexpected error occurred while completing the session.");
    } finally {
      setCompleteLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
      />

      {/* Drawer Container: Full screen on mobile, right drawer 540px on desktop */}
      <div
        data-testid="session-drawer"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-full sm:max-w-xl md:max-w-xl flex-col bg-white shadow-2xl transition-all duration-200 ease-in-out"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-4 bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                {session.caseNumber}
              </span>
              {isCompleted ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Completed
                </span>
              ) : !isToday ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-800 border border-rose-200">
                  <Clock className="h-3.5 w-3.5 text-rose-600" />
                  Not completed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-800 border border-rose-200">
                  <Clock className="h-3.5 w-3.5 text-rose-600" />
                  Pending
                </span>
              )}
            </div>
            <h2 className="text-base font-semibold text-slate-900 mt-1">
              Clinical Session Record
            </h2>
          </div>

          <button
            type="button"
            data-testid="session-drawer-close-button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close session details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMessage && (
            <div
              data-testid="session-drawer-error"
              className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successToast && (
            <div
              data-testid="session-drawer-success"
              className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"
            >
              <Check className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{successToast}</span>
            </div>
          )}

          {/* Section 1: Patient Information (Read-Only) */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Patient & Appointment Overview
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-teal-700 shrink-0" />
                <div>
                  <span className="text-slate-400 block text-[10px]">Patient</span>
                  <span
                    data-testid="session-drawer-patient-name"
                    className="font-semibold text-slate-900"
                  >
                    {session.patientName}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold">
                  #
                </span>
                <div>
                  <span className="text-slate-400 block text-[10px]">Age</span>
                  <span
                    data-testid="session-drawer-patient-age"
                    className="font-semibold text-slate-900"
                  >
                    {session.patientAge} years
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-teal-700 shrink-0" />
                <div>
                  <span className="text-slate-400 block text-[10px]">Scheduled Time</span>
                  <span className="font-semibold text-slate-900">
                    {formatTimeIST(session.scheduledAt)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-teal-700 shrink-0" />
                <div>
                  <span className="text-slate-400 block text-[10px]">Room</span>
                  <span
                    data-testid="session-drawer-room"
                    className="font-semibold text-slate-900"
                  >
                    {roomNo || "Room: Not assigned"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Optional Photo Consent Checkbox */}
          {!isReadOnly && (
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none py-1">
              <input
                type="checkbox"
                data-testid="photo-consent-checkbox"
                checked={photoConsent}
                onChange={(e) => setPhotoConsent(e.target.checked)}
                className="rounded border-slate-300 text-teal-700 focus:ring-teal-500"
              />
              <span className="flex items-center gap-1 font-medium">
                <ShieldCheck className="h-4 w-4 text-teal-700" />
                Patient has consented to photos
              </span>
            </label>
          )}

          {/* Section 2: In-Time Picture */}
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-800">
                In-time picture
              </label>
              {inTimeAt && (
                <span
                  data-testid="in-time-timestamp"
                  className="font-mono text-[11px] text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200"
                >
                  In: {formatTimeIST(inTimeAt)}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-start">
              {inTimePhotoUrl ? (
                <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-50 w-full sm:w-48 h-36 shrink-0 flex items-center justify-center shadow-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={inTimePhotoUrl}
                    alt="In-time session proof"
                    data-testid="in-time-photo-preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                    Verified
                  </div>
                </div>
              ) : (
                <div className="w-full sm:w-48 h-36 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 text-xs bg-slate-50 shrink-0">
                  <Camera className="h-6 w-6 text-slate-300 mb-1" />
                  <span>No photo yet</span>
                </div>
              )}

              {!isReadOnly && (
                <div className="space-y-2 flex-1">
                  <input
                    ref={inFileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    data-testid="in-time-photo-input"
                    className="hidden"
                    onChange={handleInTimeUpload}
                    disabled={inTimeLoading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid="in-time-photo-button"
                    onClick={() => inFileInputRef.current?.click()}
                    isLoading={inTimeLoading}
                    className="text-xs w-full sm:w-auto"
                  >
                    <Camera className="h-4 w-4 mr-1.5 text-teal-700" />
                    {inTimePhotoUrl ? "Retake photo" : "Take / upload photo"}
                  </Button>
                  <p className="text-[11px] text-slate-500">
                    Camera activates on mobile. Supported formats: JPEG, PNG, WebP (max 5 MB).
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: What you have done (Notes / Draft) */}
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-800">
                What you have done <span className="text-rose-500">*</span>
              </label>
              {workDoneSaved && (
                <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                  <Check className="h-3 w-3" /> Draft saved
                </span>
              )}
            </div>

            <Textarea
              data-testid="work-done-input"
              rows={4}
              placeholder="Detail the interventions, patient engagement, progress, and homework assigned (minimum 10 characters)..."
              value={workDone}
              onChange={(e) => {
                setWorkDone(e.target.value);
                setWorkDoneSaved(false);
              }}
              readOnly={isReadOnly}
              className="text-xs font-normal resize-y"
            />

            {!isReadOnly && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400">
                  {workDone.trim().length} character{workDone.trim().length === 1 ? "" : "s"}{" "}
                  {workDone.trim().length < 10 && "(min 10 required)"}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid="work-done-save-button"
                  onClick={handleSaveWorkDone}
                  isLoading={workDoneLoading}
                  className="h-7 text-xs"
                >
                  <Save className="h-3.5 w-3.5 mr-1" />
                  Save draft
                </Button>
              </div>
            )}
          </div>

          {/* Section 4: Out-Time Picture (Disabled until in-time photo saved) */}
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-800">
                Out-time picture
              </label>
              {outTimeAt && (
                <span
                  data-testid="out-time-timestamp"
                  className="font-mono text-[11px] text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200"
                >
                  Out: {formatTimeIST(outTimeAt)}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-start">
              {outTimePhotoUrl ? (
                <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-50 w-full sm:w-48 h-36 shrink-0 flex items-center justify-center shadow-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={outTimePhotoUrl}
                    alt="Out-time session proof"
                    data-testid="out-time-photo-preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                    Verified
                  </div>
                </div>
              ) : (
                <div className="w-full sm:w-48 h-36 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 text-xs bg-slate-50 shrink-0">
                  <Camera className="h-6 w-6 text-slate-300 mb-1" />
                  <span>
                    {!inTimePhotoUrl ? "Disabled until in-time saved" : "No photo yet"}
                  </span>
                </div>
              )}

              {!isReadOnly && (
                <div className="space-y-2 flex-1">
                  <input
                    ref={outFileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    data-testid="out-time-photo-input"
                    className="hidden"
                    onChange={handleOutTimeUpload}
                    disabled={!inTimePhotoUrl || outTimeLoading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid="out-time-photo-button"
                    onClick={() => outFileInputRef.current?.click()}
                    isLoading={outTimeLoading}
                    disabled={!inTimePhotoUrl}
                    className="text-xs w-full sm:w-auto"
                  >
                    <Camera className="h-4 w-4 mr-1.5 text-teal-700" />
                    {outTimePhotoUrl ? "Retake photo" : "Take / upload photo"}
                  </Button>
                  <p className="text-[11px] text-slate-500">
                    {!inTimePhotoUrl
                      ? "Locked: Take and save in-time photo first."
                      : "Server stamps completion timestamp automatically."}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section 5: Patient Sign (Canvas) */}
          <div className="border-t border-slate-100 pt-4">
            <PatientSignaturePad
              onSignatureChange={handleSignatureChange}
              disabled={isReadOnly || signatureLoading}
              existingSignatureUrl={isReadOnly ? signatureDataUrl : null}
            />
          </div>
        </div>

        {/* Drawer Sticky Footer with Complete Button */}
        <div className="border-t border-slate-200/80 p-4 bg-slate-50/80 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            Close
          </Button>

          {!isReadOnly && (
            <Button
              type="button"
              size="sm"
              data-testid="complete-session-button"
              disabled={!canComplete || completeLoading}
              isLoading={completeLoading}
              onClick={handleCompleteSession}
              className={`text-xs font-semibold px-4 py-2 transition-all ${
                canComplete
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed border-none"
              }`}
            >
              <Check className="h-4 w-4 mr-1.5" />
              Complete session
            </Button>
          )}

          {isCompleted && (
            <div className="text-xs text-emerald-800 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Session completed & signed
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
