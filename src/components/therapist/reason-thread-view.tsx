"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Send,
  Edit2,
  CheckCircle2,
  Clock,
  AlertCircle,
  MessageSquare,
  ShieldCheck,
  Check,
  RotateCcw,
} from "lucide-react";
import {
  getThreadForCaseTodayAction,
  submitReasonMessageAction,
  editLastReasonMessageAction,
  markThreadReadAction,
  type ThreadDetailsView,
  type ThreadMessageView,
} from "@/lib/actions/session-reason-actions";
import { useNetworkStatus } from "@/components/network/network-provider";

interface ReasonThreadViewProps {
  caseId: string;
  patientId: string;
  clientName: string;
  todayIST: string;
  isSessionRecordedToday?: boolean;
  onThreadUpdated?: () => void;
}

export function ReasonThreadView({
  caseId,
  patientId,
  clientName,
  todayIST,
  isSessionRecordedToday: externalIsSessionRecorded,
  onThreadUpdated,
}: ReasonThreadViewProps) {
  const { isOnline } = useNetworkStatus();
  const [thread, setThread] = useState<ThreadDetailsView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [bodyText, setBodyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const fetchThread = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getThreadForCaseTodayAction(caseId, todayIST);
      if (res.success && res.data) {
        setThread(res.data);
        // If there are unread messages from admin, mark read
        if (res.data.id && res.data.unreadCountForMe > 0) {
          markThreadReadAction({ threadId: res.data.id }).catch(() => {});
        }
      } else {
        setError(res.error || "Failed to load thread.");
      }
    } catch {
      setError("Failed to load reason thread.");
    } finally {
      setLoading(false);
    }
  }, [caseId, todayIST]);

  useEffect(() => {
    fetchThread();
  }, [fetchThread]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = bodyText.trim();
    if (!clean) return;

    setSubmitting(true);
    setError(null);

    try {
      if (editingMessageId) {
        // Edit existing last message
        const res = await editLastReasonMessageAction({
          messageId: editingMessageId,
          body: clean,
        });

        if (res.success) {
          setEditingMessageId(null);
          setBodyText("");
          await fetchThread();
          onThreadUpdated?.();
        } else {
          setError(res.error || "Failed to edit reason.");
        }
      } else {
        // Submit new message
        const res = await submitReasonMessageAction({
          caseId,
          body: clean,
        });

        if (res.success) {
          setBodyText("");
          await fetchThread();
          onThreadUpdated?.();
        } else {
          setError(res.error || "Failed to submit reason.");
        }
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (msg: ThreadMessageView) => {
    setEditingMessageId(msg.id);
    setBodyText(msg.body);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setBodyText("");
  };

  const isSessionRecorded =
    externalIsSessionRecorded ?? thread?.isSessionRecordedToday ?? false;
  const isLocked = thread?.isLockedMidnight ?? false;
  const isResolved = thread?.status === "resolved";

  return (
    <div data-testid="reason-thread-container" className="space-y-4">
      {/* Thread Subheader */}
      <div className="flex items-center justify-between border-b border-stone-200 pb-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#0B7A63]" />
          <h4 className="text-sm font-bold uppercase tracking-wide text-stone-900">
            Session Reason Thread
          </h4>
        </div>
        {thread?.status && (
          <span
            data-testid="thread-status-badge"
            className={`px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${
              thread.status === "resolved"
                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                : "bg-amber-100 text-amber-800 border border-amber-300"
            }`}
          >
            {thread.status === "resolved" ? "Resolved" : "Open"}
          </span>
        )}
      </div>

      {/* Helper Line */}
      <p className="text-xs text-stone-500 font-medium">
        Keep it short. Do not write patient names or medical details here.
      </p>

      {/* Session Recorded Banner */}
      {isSessionRecorded && (
        <div
          data-testid="session-recorded-banner"
          className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Session recorded today. New reasons are locked.</span>
        </div>
      )}

      {/* Midnight Lock Banner */}
      {isLocked && !isSessionRecorded && (
        <div
          data-testid="thread-locked-banner"
          className="p-3 bg-stone-100 border border-stone-300 text-stone-700 text-xs font-medium flex items-center gap-2"
        >
          <Clock className="w-4 h-4 text-stone-500 shrink-0" />
          <span>Past midnight IST. This thread is now read-only.</span>
        </div>
      )}

      {/* Resolved Banner */}
      {isResolved && !isSessionRecorded && !isLocked && (
        <div
          data-testid="thread-resolved-banner"
          className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium flex items-center gap-2"
        >
          <Check className="w-4 h-4 text-blue-600 shrink-0" />
          <span>Thread marked resolved by administrator. Ask admin to reopen if needed.</span>
        </div>
      )}

      {/* Messages List */}
      <div
        data-testid="reason-thread-messages"
        className="space-y-3 max-h-[45vh] overflow-y-auto pr-1"
      >
        {loading ? (
          <div className="p-6 text-center text-xs text-stone-400">
            Loading reason conversation...
          </div>
        ) : thread?.messages.length === 0 ? (
          <div className="p-5 border border-dashed border-stone-200 bg-stone-50 text-center text-xs text-stone-500">
            No reason submitted yet for today. If today&apos;s session cannot be completed, record your reason below.
          </div>
        ) : (
          thread?.messages.map((msg, index) => {
            const isLast = index === (thread.messages.length - 1);
            return (
              <div
                key={msg.id}
                data-testid={`reason-message-${msg.id}`}
                className={`p-3 border rounded-none ${
                  msg.isMine
                    ? "bg-[#E8F5F1] border-[#0B7A63]/30 ml-4 sm:ml-8"
                    : "bg-white border-stone-200 mr-4 sm:mr-8 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-stone-900">
                      {msg.isMine ? "You" : `Admin (${msg.authorName})`}
                    </span>
                    {!msg.isMine && !msg.isRead && (
                      <span
                        data-testid="thread-unread-dot"
                        className="w-2 h-2 rounded-full bg-[#0B7A63]"
                        title="Unread message"
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {msg.isEdited && (
                      <span
                        data-testid="message-edited-badge"
                        className="text-[10px] italic text-stone-500 font-medium"
                      >
                        (edited)
                      </span>
                    )}
                    <span className="text-[11px] text-stone-500 font-mono">
                      {msg.formattedTimeIST}
                    </span>
                  </div>
                </div>

                {/* Message Body */}
                <p className="text-xs text-stone-800 whitespace-pre-wrap break-words leading-relaxed">
                  {msg.body}
                </p>

                {/* Message Footer: Read status & Edit button */}
                <div className="flex items-center justify-between pt-2 mt-2 border-t border-stone-200/50 text-[11px]">
                  {msg.isMine ? (
                    <span
                      data-testid="message-read-status"
                      className="text-stone-500 flex items-center gap-1"
                    >
                      {msg.isRead ? (
                        <>
                          <ShieldCheck className="w-3 h-3 text-[#0B7A63]" />
                          <span>Seen</span>
                        </>
                      ) : (
                        <span>Sent</span>
                      )}
                    </span>
                  ) : (
                    <span />
                  )}

                  {msg.isMine && isLast && thread.canEditLast && (
                    <button
                      type="button"
                      data-testid="edit-reason-msg-btn"
                      onClick={() => handleStartEdit(msg)}
                      className="inline-flex items-center gap-1 text-[#0B7A63] hover:underline font-bold text-[11px] cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Error alert */}
      {error && (
        <div
          data-testid="reason-error-msg"
          className="p-3 bg-red-50 border border-red-300 text-red-800 text-xs font-medium flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Input Form: Visible only if sending is allowed */}
      {thread?.canSend && (
        <form onSubmit={handleSend} className="space-y-2 pt-2 border-t border-stone-200">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
            {editingMessageId ? "Edit your last reason" : "Why is today's session not done?"}{" "}
            <span className="text-red-500">*</span>
          </label>

          <textarea
            data-testid="reason-body-input"
            rows={3}
            maxLength={1000}
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            placeholder="Explain why session could not be completed today..."
            className="w-full border border-stone-300 px-3 py-2 text-xs focus:outline-none focus:border-[#0B7A63] rounded-none bg-white font-medium resize-none"
            disabled={submitting}
          />

          <div className="flex items-center justify-between text-[11px] text-stone-500 px-0.5">
            <span data-testid="reason-char-counter">
              {bodyText.length} / 1000 characters
            </span>
            {editingMessageId && (
              <button
                type="button"
                data-testid="cancel-edit-reason-btn"
                onClick={handleCancelEdit}
                className="text-stone-600 hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Cancel edit</span>
              </button>
            )}
          </div>

          <button
            type="submit"
            data-testid="send-reason-btn"
            disabled={submitting || !bodyText.trim() || !isOnline}
            className="w-full min-h-[48px] bg-[#0B7A63] hover:bg-[#086350] disabled:bg-stone-300 text-white text-xs font-bold uppercase tracking-wider rounded-none shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer touch-manipulation select-none"
          >
            <Send className="w-4 h-4" />
            <span>
              {!isOnline
                ? "Connect to save"
                : submitting
                ? "Submitting..."
                : editingMessageId
                ? "Save edited reason"
                : thread?.messages.length > 0
                ? "Send update"
                : "Send reason"}
            </span>
          </button>
        </form>
      )}
    </div>
  );
}

