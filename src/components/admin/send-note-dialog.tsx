"use client";

import * as React from "react";
import { Icons } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { WritingAssist } from "@/components/writing-assist/writing-assist";
import { sendAdminNoteAction } from "@/lib/actions/admin-notes-actions";

interface SendNoteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  therapistId: string;
  therapistName: string;
  onSuccess?: () => void;
}

export function SendNoteDialog({
  isOpen,
  onClose,
  therapistId,
  therapistName,
  onSuccess,
}: SendNoteDialogProps) {
  const [note, setNote] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setNote("");
      setError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = note.trim();
    if (trimmed.length < 5) {
      setError("Note must be at least 5 characters.");
      return;
    }
    if (trimmed.length > 1000) {
      setError("Note cannot exceed 1,000 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await sendAdminNoteAction({
        toUserId: therapistId,
        message: trimmed,
      });

      if (!res.success) {
        setError(res.error || "Failed to send note.");
        setIsSubmitting(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 900);
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-note-title"
      data-testid="send-note-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
    >
      <div className="w-full max-w-lg border border-slate-200 bg-white shadow-xl rounded-none animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-none bg-[#0B7A63] text-white">
              <Icons.Envelope className="h-4 w-4" />
            </div>
            <div>
              <h2
                id="send-note-title"
                className="text-sm font-bold uppercase tracking-wider text-slate-900"
              >
                Send Note
              </h2>
              <p className="text-[11px] text-slate-500">
                Direct administrative note to practitioner
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-none hover:bg-slate-200 transition-colors"
            aria-label="Close dialog"
          >
            <Icons.Close className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div
              data-testid="send-note-error"
              className="p-3 text-xs bg-red-50 border border-red-200 text-red-800 rounded-none flex items-start gap-2"
            >
              <Icons.Alert className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div
              data-testid="send-note-success"
              className="p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-none flex items-center gap-2"
            >
              <Icons.Check className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Note dispatched successfully!</span>
            </div>
          )}

          {/* Recipient: Fixed */}
          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              To
            </label>
            <input
              type="text"
              readOnly
              value={therapistName}
              data-testid="send-note-recipient-input"
              className="w-full border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-800 rounded-none cursor-not-allowed select-none focus:outline-none"
            />
          </div>

          {/* Note Input */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="admin-note-text"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                Note <span className="text-red-500">*</span>
              </label>
              <span data-testid="note-char-counter" className="text-[11px] text-slate-400 font-mono">
                {note.length}/1000
              </span>
            </div>
            <textarea
              id="admin-note-text"
              data-testid="note-message-textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Write administrative message or instruction here..."
              rows={5}
              required
              minLength={5}
              maxLength={1000}
              spellCheck={true}
              lang="en-IN"
              autoCapitalize="sentences"
              autoComplete="off"
              className="w-full border border-slate-300 p-3 text-base sm:text-xs text-slate-900 rounded-none focus:outline-none focus:border-[#0B7A63] focus:ring-1 focus:ring-[#0B7A63] font-sans resize-none"
            />
            <WritingAssist
              text={note}
              onApplyText={(val) => setNote(val)}
              context="admin_note"
              knownNames={[therapistName]}
            />
            <p className="text-[11px] text-amber-700 bg-amber-50/70 p-2 border border-amber-200 rounded-none font-medium">
              Do not write patient names or medical details here.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              data-testid="send-note-cancel-btn"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting || note.trim().length < 5 || success}
              data-testid="submit-note-button"
            >
              {isSubmitting ? "Sending..." : "Send Note"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
