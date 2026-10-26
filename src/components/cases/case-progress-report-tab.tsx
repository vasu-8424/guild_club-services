"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  saveReportDraftAction,
  submitReportAction,
  updateReportAction,
  getCaseReportsAction,
  type ProgressReportItem,
} from "@/lib/actions/progress-report-actions";
import { formatDisplayDate } from "@/lib/date-utils";
import {
  FileText,
  Plus,
  Edit2,
  Lock,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  History,
} from "lucide-react";

interface CaseProgressReportTabProps {
  caseId: string;
  patientId: string;
  isOwner: boolean;
  isClosed: boolean;
  initialReports: ProgressReportItem[];
}

export function CaseProgressReportTab({
  caseId,
  patientId,
  isOwner,
  isClosed,
  initialReports,
}: CaseProgressReportTabProps) {
  const router = useRouter();
  const [reports, setReports] = useState<ProgressReportItem[]>(initialReports);
  const [isWriting, setIsWriting] = useState(initialReports.length === 0 && isOwner && !isClosed);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editingStatus, setEditingStatus] = useState<"draft" | "submitted">("draft");

  // Form Fields
  const [currentCondition, setCurrentCondition] = useState("");
  const [progressText, setProgressText] = useState("");
  const [treatmentPlan, setTreatmentPlan] = useState("");
  const [remarks, setRemarks] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  React.useEffect(() => {
    setReports(initialReports);
  }, [initialReports]);

  const resetForm = () => {
    setIsWriting(false);
    setEditingReportId(null);
    setEditingStatus("draft");
    setCurrentCondition("");
    setProgressText("");
    setTreatmentPlan("");
    setRemarks("");
    setError(null);
    setFieldErrors({});
  };

  const handleStartNewReport = () => {
    resetForm();
    setIsWriting(true);
  };

  const handleStartEdit = (rep: ProgressReportItem) => {
    setEditingReportId(rep.id);
    setEditingStatus(rep.status);
    setCurrentCondition(rep.currentCondition);
    setProgressText(rep.progressText);
    setTreatmentPlan(rep.treatmentPlan || "");
    setRemarks(rep.remarks || "");
    setError(null);
    setFieldErrors({});
    setIsWriting(true);
  };

  // Save Draft
  const handleSaveDraft = async () => {
    setError(null);
    setFieldErrors({});
    setSuccessMessage(null);

    if (!currentCondition.trim()) {
      setFieldErrors({ currentCondition: "Current condition is required to save a draft." });
      return;
    }

    setLoading(true);
    const res = await saveReportDraftAction({
      caseId,
      reportId: editingReportId || undefined,
      currentCondition: currentCondition.trim(),
      progressText: progressText.trim() || undefined,
      treatmentPlan: treatmentPlan.trim() || undefined,
      remarks: remarks.trim() || undefined,
    });
    setLoading(false);

    if (res.success) {
      setSuccessMessage("Draft saved successfully.");
      resetForm();
      const updated = await getCaseReportsAction(caseId);
      if (updated.success && updated.reports) {
        setReports(updated.reports);
      }
      router.refresh();
    } else {
      setError(res.error || "Failed to save draft.");
      if (res.fieldErrors) setFieldErrors(res.fieldErrors);
    }
  };

  // Submit Report (or update existing submitted report if within 24h)
  const handleSubmitReport = async () => {
    setError(null);
    setFieldErrors({});
    setSuccessMessage(null);

    const errors: Record<string, string> = {};
    if (!currentCondition.trim() || currentCondition.trim().length < 10) {
      errors.currentCondition = "Current condition must be at least 10 characters.";
    }
    if (!progressText.trim() || progressText.trim().length < 20) {
      errors.progressText = "Progress since last report must be at least 20 characters.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError("Please satisfy the minimum character requirements.");
      return;
    }

    setLoading(true);

    let res;
    if (editingReportId && editingStatus === "submitted") {
      // Editing an already submitted report within 24h
      res = await updateReportAction({
        reportId: editingReportId,
        caseId,
        currentCondition: currentCondition.trim(),
        progressText: progressText.trim(),
        treatmentPlan: treatmentPlan.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });
    } else {
      // New submission or submitting a draft
      res = await submitReportAction({
        caseId,
        reportId: editingReportId || undefined,
        currentCondition: currentCondition.trim(),
        progressText: progressText.trim(),
        treatmentPlan: treatmentPlan.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });
    }

    setLoading(false);

    if (res.success) {
      setSuccessMessage(
        editingReportId && editingStatus === "submitted"
          ? "Report updated and new version saved."
          : "Progress report submitted successfully."
      );
      resetForm();
      const updated = await getCaseReportsAction(caseId);
      if (updated.success && updated.reports) {
        setReports(updated.reports);
      }
      router.refresh();
    } else {
      setError(res.error || "Failed to submit progress report.");
      if (res.fieldErrors) setFieldErrors(res.fieldErrors);
    }
  };

  return (
    <div className="space-y-6 text-left" data-testid="progress-report-tab-content">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-stone-200 p-4 rounded-none shadow-xs">
        <div>
          <h2 className="text-base font-bold uppercase tracking-tight text-stone-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#0B7A63]" />
            <span>Progress Reports</span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Therapist-authored narrative evaluations, milestone observations, and care adjustments
          </p>
        </div>

        {isOwner && !isClosed && !isWriting && (
          <button
            type="button"
            data-testid="write-report-btn"
            onClick={handleStartNewReport}
            className="inline-flex items-center gap-1.5 bg-[#0B7A63] hover:bg-[#096350] text-white px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-none transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Write Report</span>
          </button>
        )}
      </div>

      {isClosed && (
        <div className="p-3 bg-stone-100 border border-stone-200 text-stone-700 text-xs flex items-center gap-2">
          <Lock className="w-4 h-4 text-stone-500 shrink-0" />
          <span>This case is closed. Progress reports are locked and new entries cannot be submitted.</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <span>{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Writing / Editing Form */}
      {isWriting && (
        <div
          data-testid="report-writing-form"
          className="bg-white border-2 border-[#0B7A63] p-6 rounded-none shadow-md space-y-5"
        >
          <div className="flex items-center justify-between border-b border-stone-200 pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-tight text-stone-900">
                {editingReportId
                  ? editingStatus === "submitted"
                    ? "Edit Submitted Report (Version Update)"
                    : "Edit Draft Report"
                  : "Write Clinical Progress Report"}
              </h3>
              <p className="text-xs text-stone-500 font-mono mt-0.5">
                Patient: {patientId} • Date: Today (Asia/Kolkata)
              </p>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="p-1 text-stone-400 hover:text-stone-700"
              title="Cancel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Field 1: Current condition */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-stone-800 block">
                  Current Condition of the Patient <span className="text-red-500">*</span>
                </label>
                <span
                  data-testid="condition-char-count"
                  className="text-[10px] text-stone-400 font-mono"
                >
                  {currentCondition.length}/3000 (min 10)
                </span>
              </div>
              <textarea
                data-testid="report-condition-input"
                value={currentCondition}
                onChange={(e) => setCurrentCondition(e.target.value)}
                maxLength={3000}
                rows={3}
                placeholder="State the patient's present functional mobility, symptom presentation, or daily functioning..."
                className="w-full border border-stone-300 p-2.5 text-xs focus:outline-none focus:border-[#0B7A63] rounded-none bg-white font-sans"
                required
              />
              <p className="text-[11px] text-stone-400">
                Example: Patient demonstrates improved swallowing coordination; manages pureed meals without choking.
              </p>
              {fieldErrors.currentCondition && (
                <p data-testid="condition-error" className="text-[11px] text-red-600 font-medium">
                  {fieldErrors.currentCondition}
                </p>
              )}
            </div>

            {/* Field 2: Progress since last report */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-stone-800 block">
                  Progress Since Last Report (What improved, what did not) <span className="text-red-500">*</span>
                </label>
                <span
                  data-testid="progress-char-count"
                  className="text-[10px] text-stone-400 font-mono"
                >
                  {progressText.length}/3000 (min 20)
                </span>
              </div>
              <textarea
                data-testid="report-progress-input"
                value={progressText}
                onChange={(e) => setProgressText(e.target.value)}
                maxLength={3000}
                rows={4}
                placeholder="Detail clinical progression: what functional goals were met, what challenges remain..."
                className="w-full border border-stone-300 p-2.5 text-xs focus:outline-none focus:border-[#0B7A63] rounded-none bg-white font-sans"
                required
              />
              <p className="text-[11px] text-stone-400">
                Example: Oral transit latency reduced by 50%. Thin liquids still require chin-tuck posture to prevent aspiration.
              </p>
              {fieldErrors.progressText && (
                <p data-testid="progress-error" className="text-[11px] text-red-600 font-medium">
                  {fieldErrors.progressText}
                </p>
              )}
            </div>

            {/* Field 3: Treatment given and plan ahead */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-stone-800 block">
                  Treatment Given & Plan Ahead <span className="text-stone-400 font-normal">(Optional)</span>
                </label>
                <span
                  data-testid="treatment-char-count"
                  className="text-[10px] text-stone-400 font-mono"
                >
                  {treatmentPlan.length}/3000
                </span>
              </div>
              <textarea
                data-testid="report-treatment-input"
                value={treatmentPlan}
                onChange={(e) => setTreatmentPlan(e.target.value)}
                maxLength={3000}
                rows={2}
                placeholder="Therapeutic exercises, frequency adjustments, or upcoming milestones planned..."
                className="w-full border border-stone-300 p-2.5 text-xs focus:outline-none focus:border-[#0B7A63] rounded-none bg-white font-sans"
              />
              <p className="text-[11px] text-stone-400">
                Example: Neuromuscular electrical stimulation continued 3x/week. Introduce nectar-thick liquids next cycle.
              </p>
            </div>

            {/* Field 4: Remarks */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-stone-800 block">
                  Remarks <span className="text-stone-400 font-normal">(Optional)</span>
                </label>
                <span
                  data-testid="remarks-char-count"
                  className="text-[10px] text-stone-400 font-mono"
                >
                  {remarks.length}/3000
                </span>
              </div>
              <textarea
                data-testid="report-remarks-input"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                maxLength={3000}
                rows={2}
                placeholder="Family counseling notes, adherence, or multidisciplinary observations..."
                className="w-full border border-stone-300 p-2.5 text-xs focus:outline-none focus:border-[#0B7A63] rounded-none bg-white font-sans"
              />
              <p className="text-[11px] text-stone-400">
                Example: Family instructed on meal pacing and posture support during evening meals.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-stone-200">
            <span className="text-[11px] text-stone-500">
              {editingStatus === "submitted"
                ? "Edits within 24 hours of submission create a new version."
                : "Drafts remain private until submitted."}
            </span>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-stone-300 text-stone-700 hover:bg-stone-100 text-xs font-semibold uppercase tracking-wider rounded-none"
              >
                Cancel
              </button>

              {editingStatus !== "submitted" && (
                <button
                  type="button"
                  data-testid="save-draft-btn"
                  disabled={loading}
                  onClick={handleSaveDraft}
                  className="px-4 py-2 border border-stone-800 text-stone-900 hover:bg-stone-100 text-xs font-semibold uppercase tracking-wider rounded-none disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Save Draft"}
                </button>
              )}

              <button
                type="button"
                data-testid="submit-report-btn"
                disabled={loading}
                onClick={handleSubmitReport}
                className="bg-[#0B7A63] hover:bg-[#096350] text-white px-5 py-2 text-xs font-semibold uppercase tracking-wider rounded-none disabled:opacity-50 transition-colors"
              >
                {loading
                  ? "Submitting..."
                  : editingReportId && editingStatus === "submitted"
                  ? "Update Report"
                  : "Submit Report"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reports Timeline */}
      <div className="space-y-4" data-testid="reports-timeline">
        {reports.length === 0 ? (
          <div className="bg-white border border-stone-200 p-8 rounded-none text-center shadow-xs">
            <FileText className="w-8 h-8 text-stone-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold uppercase tracking-tight text-stone-700">
              No progress report has been written yet
            </h3>
            <p className="text-xs text-stone-400 max-w-md mx-auto mt-1 mb-4">
              Progress reports are written in your own words to track functional outcomes, milestone achievements, and clinical plans.
            </p>
            {isOwner && !isClosed && (
              <button
                type="button"
                data-testid="write-first-report-btn"
                onClick={handleStartNewReport}
                className="bg-[#0B7A63] hover:bg-[#096350] text-white px-5 py-2 text-xs font-semibold uppercase tracking-wider rounded-none transition-colors"
              >
                Write First Report
              </button>
            )}
          </div>
        ) : (
          reports.map((rep, idx) => (
            <div
              key={rep.id}
              data-testid="timeline-report-item"
              className={`bg-white border p-5 rounded-none shadow-xs space-y-4 transition-all ${
                rep.status === "draft"
                  ? "border-amber-300 bg-amber-50/20"
                  : "border-stone-200"
              }`}
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-xs font-mono font-bold text-stone-900">
                    {rep.reportDate}
                  </span>

                  {/* Type Tag */}
                  <span
                    data-testid="report-type-tag"
                    className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border rounded-none ${
                      rep.reportType === "final"
                        ? "bg-purple-100 text-purple-800 border-purple-300"
                        : "bg-teal-50 text-teal-800 border-teal-200"
                    }`}
                  >
                    {rep.reportType === "final" ? "Final Report" : "Progress Update"}
                  </span>

                  {/* Status Badge */}
                  <span
                    data-testid={rep.status === "draft" ? "report-badge-draft" : "report-badge-submitted"}
                    className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border rounded-none ${
                      rep.status === "draft"
                        ? "bg-amber-100 text-amber-800 border-amber-300"
                        : "bg-emerald-50 text-emerald-800 border-emerald-200"
                    }`}
                  >
                    {rep.status === "draft" ? "Draft" : "Submitted"}
                  </span>

                  {/* (edited) badge */}
                  {rep.versionCount > 0 && (
                    <span
                      data-testid="report-edited-badge"
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-stone-500 bg-stone-100 px-1.5 py-0.5 border border-stone-200"
                      title={`${rep.versionCount} previous versions recorded`}
                    >
                      <History className="w-3 h-3 text-stone-400" />
                      <span>(edited)</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-stone-500">
                    By <strong>{rep.authorName}</strong>
                  </span>

                  {rep.canEdit && !isWriting && (
                    <button
                      type="button"
                      data-testid="edit-report-btn"
                      onClick={() => handleStartEdit(rep)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B7A63] hover:text-[#096350] border border-stone-300 hover:border-[#0B7A63] px-2.5 py-1 rounded-none bg-stone-50 transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Narrative Content */}
              <div className="space-y-3 text-xs leading-relaxed">
                <div>
                  <h4 className="text-[10px] uppercase font-bold text-stone-400 tracking-wider mb-0.5">
                    Current Condition
                  </h4>
                  <p className="text-stone-800 whitespace-pre-wrap font-sans bg-stone-50/60 p-2.5 border border-stone-100">
                    {rep.currentCondition}
                  </p>
                </div>

                <div>
                  <h4 className="text-[10px] uppercase font-bold text-stone-400 tracking-wider mb-0.5">
                    Progress Since Last Report
                  </h4>
                  <p className="text-stone-800 whitespace-pre-wrap font-sans bg-stone-50/60 p-2.5 border border-stone-100">
                    {rep.progressText}
                  </p>
                </div>

                {rep.treatmentPlan && (
                  <div>
                    <h4 className="text-[10px] uppercase font-bold text-stone-400 tracking-wider mb-0.5">
                      Treatment Given & Plan Ahead
                    </h4>
                    <p className="text-stone-700 whitespace-pre-wrap font-sans bg-stone-50/40 p-2 border border-stone-100">
                      {rep.treatmentPlan}
                    </p>
                  </div>
                )}

                {rep.remarks && (
                  <div>
                    <h4 className="text-[10px] uppercase font-bold text-stone-400 tracking-wider mb-0.5">
                      Remarks
                    </h4>
                    <p className="text-stone-700 whitespace-pre-wrap font-sans bg-stone-50/40 p-2 border border-stone-100">
                      {rep.remarks}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
