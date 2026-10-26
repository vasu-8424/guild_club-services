"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { OUTCOME_OPTIONS, type SimplifiedOutcome } from "@/lib/services";
import {
  closeCaseTherapistAction,
  type CloseCasePhotoInput,
} from "@/lib/actions/case-close-actions";
import { Camera, Trash2, AlertTriangle, X } from "lucide-react";

interface CloseCaseModalProps {
  caseId: string;
  patientId: string;
  caseNumber: string;
  onSuccess?: () => void;
}

export function CloseCaseModal({
  caseId,
  patientId,
  caseNumber,
  onSuccess,
}: CloseCaseModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Written Final Progress Report State
  const [currentCondition, setCurrentCondition] = useState("");
  const [progressText, setProgressText] = useState("");
  const [treatmentPlan, setTreatmentPlan] = useState("");
  const [remarks, setRemarks] = useState("");

  // Closure details
  const [outcome, setOutcome] = useState<SimplifiedOutcome>("improved");
  const [closingSummary, setClosingSummary] = useState("");
  const [photos, setPhotos] = useState<
    Array<{
      base64Data: string;
      filename: string;
      contentType: string;
      previewUrl: string;
    }>
  >([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (photos.length + files.length > 3) {
      setError("Maximum 3 present condition photos allowed.");
      return;
    }

    Array.from(files).forEach((file) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setError("Only JPEG, PNG, and WebP images are allowed.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
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

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL(file.type, 0.85);

            setPhotos((prev) => {
              if (prev.length >= 3) return prev;
              return [
                ...prev,
                {
                  base64Data: compressed,
                  filename: file.name,
                  contentType: file.type,
                  previewUrl: compressed,
                },
              ];
            });
            setError(null);
          }
        };
        img.src = loadEvent.target?.result as string;
      };
      reader.readAsDataURL(file);
    });

    e.target.value = "";
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Pre-validation before confirmation prompt
  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const errors: Record<string, string> = {};

    if (!currentCondition.trim() || currentCondition.trim().length < 10) {
      errors.currentCondition = "Current condition must be at least 10 characters.";
    }

    if (!progressText.trim() || progressText.trim().length < 20) {
      errors.progressText = "Progress since last report must be at least 20 characters.";
    }

    if (photos.length === 0) {
      errors.photos = "At least one present condition photo is required.";
    }

    if (!closingSummary.trim()) {
      errors.closingSummary = "Closing summary is required.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError("Please complete all required fields with sufficient detail.");
      return;
    }

    setShowConfirm(true);
  };

  // Final submission after confirmation
  const handleFinalClose = async () => {
    setLoading(true);
    setError(null);

    const res = await closeCaseTherapistAction({
      caseId,
      currentCondition: currentCondition.trim(),
      progressText: progressText.trim(),
      treatmentPlan: treatmentPlan.trim() || undefined,
      remarks: remarks.trim() || undefined,
      outcome,
      closingSummary: closingSummary.trim(),
      photos: photos.map((p) => ({
        base64Data: p.base64Data,
        filename: p.filename,
        contentType: p.contentType,
      })),
    });

    setLoading(false);

    if (res.success) {
      setShowConfirm(false);
      setIsOpen(false);
      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }
    } else {
      setShowConfirm(false);
      setError(res.error || "Failed to close case.");
      if (res.fieldErrors) setFieldErrors(res.fieldErrors);
    }
  };

  return (
    <>
      <button
        type="button"
        data-testid="close-case-btn"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 border border-red-300 bg-red-50 hover:bg-red-100 text-red-800 px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-none transition-colors"
      >
        <span>Close Case</span>
      </button>

      {/* Main Close Form Modal */}
      {isOpen && (
        <div
          data-testid="close-case-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <div className="bg-white border-2 border-stone-900 w-full max-w-2xl shadow-2xl rounded-none my-8 flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50">
              <div>
                <h3 className="text-base font-bold uppercase tracking-tight text-stone-900">
                  Close Case & Submit Final Progress Report: {patientId}
                </h3>
                <p className="text-xs text-stone-500 font-mono">Case Ref: {caseNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleProceedToConfirm} className="p-6 overflow-y-auto flex-1 space-y-6 text-left">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs">
                  {error}
                </div>
              )}

              <div className="bg-emerald-50/60 border border-emerald-200 p-3 text-xs text-emerald-900 font-sans">
                <strong>Final Clinical Progress Report:</strong> You are required to write the patient's final progress evaluation in your own words. The system does not auto-generate text.
              </div>

              {/* 1. Current condition at closing */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-stone-800 block">
                    Current Condition of the Patient <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-stone-400 font-mono">
                    {currentCondition.length}/3000 (min 10)
                  </span>
                </div>
                <textarea
                  data-testid="close-present-condition-input"
                  value={currentCondition}
                  onChange={(e) => setCurrentCondition(e.target.value)}
                  maxLength={3000}
                  rows={3}
                  placeholder="Describe patient's condition, mobility, or functional status at discharge..."
                  className="w-full border border-stone-300 p-2.5 text-xs focus:outline-none focus:border-[#0B7A63] rounded-none bg-white font-sans"
                  required
                />
                <p className="text-[11px] text-stone-400">
                  Example: Patient swallows pureed and soft solids comfortably without choking.
                </p>
                {fieldErrors.currentCondition && (
                  <p className="text-[11px] text-red-600 font-medium">{fieldErrors.currentCondition}</p>
                )}
              </div>

              {/* 2. Progress since last report */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-stone-800 block">
                    Progress Since Last Report (What improved, what did not) <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-stone-400 font-mono">
                    {progressText.length}/3000 (min 20)
                  </span>
                </div>
                <textarea
                  data-testid="close-progress-text-input"
                  value={progressText}
                  onChange={(e) => setProgressText(e.target.value)}
                  maxLength={3000}
                  rows={4}
                  placeholder="Detail clinical progression: what functional goals were met, what challenges remain..."
                  className="w-full border border-stone-300 p-2.5 text-xs focus:outline-none focus:border-[#0B7A63] rounded-none bg-white font-sans"
                  required
                />
                <p className="text-[11px] text-stone-400">
                  Example: Oral transit time reduced by 50%. Laryngeal elevation has returned to functional baseline.
                </p>
                {fieldErrors.progressText && (
                  <p className="text-[11px] text-red-600 font-medium">{fieldErrors.progressText}</p>
                )}
              </div>

              {/* 3. Treatment given and plan ahead */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-stone-800 block">
                    Treatment Given & Plan Ahead <span className="text-stone-400 font-normal">(Optional)</span>
                  </label>
                  <span className="text-[10px] text-stone-400 font-mono">
                    {treatmentPlan.length}/3000
                  </span>
                </div>
                <textarea
                  data-testid="close-treatment-plan-input"
                  value={treatmentPlan}
                  onChange={(e) => setTreatmentPlan(e.target.value)}
                  maxLength={3000}
                  rows={2}
                  placeholder="Therapeutic modalities administered and home maintenance regime..."
                  className="w-full border border-stone-300 p-2.5 text-xs focus:outline-none focus:border-[#0B7A63] rounded-none bg-white font-sans"
                />
                <p className="text-[11px] text-stone-400">
                  Example: 10 sessions of VitalStim therapy completed. Home swallowing maneuvers prescribed.
                </p>
              </div>

              {/* 4. Remarks */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-stone-800 block">
                    Remarks <span className="text-stone-400 font-normal">(Optional)</span>
                  </label>
                  <span className="text-[10px] text-stone-400 font-mono">
                    {remarks.length}/3000
                  </span>
                </div>
                <textarea
                  data-testid="close-remarks-input"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  maxLength={3000}
                  rows={2}
                  placeholder="Additional observations, family counseling, or referrals..."
                  className="w-full border border-stone-300 p-2.5 text-xs focus:outline-none focus:border-[#0B7A63] rounded-none bg-white font-sans"
                />
                <p className="text-[11px] text-stone-400">
                  Example: Caregiver trained on meal texture modification.
                </p>
              </div>

              {/* 5. Photos at closing (1-3) */}
              <div className="space-y-2 pt-2 border-t border-stone-200">
                <label className="text-xs font-semibold text-stone-800 block">
                  Present Condition Photos (1–3) <span className="text-red-500">*</span>
                </label>

                <div className="flex flex-wrap gap-3 items-center">
                  {photos.map((photo, index) => (
                    <div
                      key={index}
                      className="relative w-24 h-24 border border-stone-300 bg-stone-100 rounded-none overflow-hidden"
                    >
                      <img
                        src={photo.previewUrl}
                        alt={`Present condition ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-none"
                        title="Remove photo"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {photos.length < 3 && (
                    <label className="w-24 h-24 border-2 border-dashed border-stone-300 hover:border-[#0B7A63] flex flex-col items-center justify-center cursor-pointer bg-stone-50 hover:bg-stone-100 transition-colors rounded-none p-2 text-center">
                      <Camera className="w-5 h-5 text-stone-400 mb-1" />
                      <span className="text-[10px] font-semibold text-stone-600">
                        {photos.length === 0 ? "Add Photo" : "Add Another"}
                      </span>
                      <input
                        type="file"
                        data-testid="close-photo-input"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
                {fieldErrors.photos && (
                  <p className="text-[11px] text-red-600 font-medium">{fieldErrors.photos}</p>
                )}
              </div>

              {/* 6. Outcome */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-800 block">
                  Clinical Outcome <span className="text-red-500">*</span>
                </label>
                <select
                  data-testid="close-outcome-select"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as SimplifiedOutcome)}
                  className="w-full border border-stone-300 px-3 py-2 text-xs focus:outline-none focus:border-[#0B7A63] rounded-none bg-white font-medium"
                >
                  {OUTCOME_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 7. Closing Summary */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-800 block">
                  Closing Summary <span className="text-red-500">*</span>
                </label>
                <textarea
                  data-testid="close-summary-input"
                  value={closingSummary}
                  onChange={(e) => setClosingSummary(e.target.value)}
                  rows={2}
                  placeholder="Summary of course of care and discharge recommendation..."
                  className="w-full border border-stone-300 p-2 text-xs focus:outline-none focus:border-[#0B7A63] rounded-none bg-white font-sans"
                  required
                />
                {fieldErrors.closingSummary && (
                  <p className="text-[11px] text-red-600 font-medium">{fieldErrors.closingSummary}</p>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 border border-stone-300 text-stone-700 hover:bg-stone-100 text-xs font-semibold uppercase tracking-wider rounded-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-red-700 hover:bg-red-800 text-white px-5 py-2 text-xs font-semibold uppercase tracking-wider rounded-none transition-colors"
                >
                  Review & Close Case
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Safeguard Dialog */}
      {showConfirm && (
        <div
          data-testid="close-case-confirm-dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/70 backdrop-blur-sm p-4"
        >
          <div className="bg-white border-2 border-red-700 max-w-md w-full p-6 shadow-2xl rounded-none text-center">
            <div className="w-12 h-12 bg-red-100 text-red-700 border border-red-300 mx-auto flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold uppercase tracking-tight text-stone-900 mb-2">
              Close case {patientId}?
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed mb-6 font-medium">
              Close case {patientId}? You cannot add sessions after closing.
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 border border-stone-300 text-stone-700 hover:bg-stone-100 text-xs font-semibold uppercase tracking-wider rounded-none"
              >
                Back
              </button>
              <button
                type="button"
                data-testid="confirm-close-case-btn"
                disabled={loading}
                onClick={handleFinalClose}
                className="bg-red-700 hover:bg-red-800 text-white px-6 py-2 text-xs font-semibold uppercase tracking-wider rounded-none disabled:opacity-50"
              >
                {loading ? "Closing..." : "Yes, Close Case"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
