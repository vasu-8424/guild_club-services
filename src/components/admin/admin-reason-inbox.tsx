"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Send,
  User,
  ShieldAlert,
  RotateCcw,
  Check,
} from "lucide-react";
import {
  getAdminReasonInboxAction,
  getThreadForCaseTodayAction,
  replyReasonMessageAction,
  markThreadResolvedAction,
  reopenThreadAction,
  markThreadReadAction,
  type AdminReasonInboxItem,
  type ThreadDetailsView,
} from "@/lib/actions/session-reason-actions";

interface AdminReasonInboxProps {
  selectedDate: string;
  activeBranchId?: string;
  onRefreshNeeded?: () => void;
}

export function AdminReasonInbox({
  selectedDate,
  activeBranchId,
  onRefreshNeeded,
}: AdminReasonInboxProps) {
  const [threads, setThreads] = useState<AdminReasonInboxItem[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drawer / modal state
  const [selectedThreadSummary, setSelectedThreadSummary] =
    useState<AdminReasonInboxItem | null>(null);
  const [threadDetails, setThreadDetails] = useState<ThreadDetailsView | null>(
    null
  );
  const [loadingThread, setLoadingThread] = useState(false);

  // Reply form state
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadInbox = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAdminReasonInboxAction({
        date: selectedDate,
        branchId: activeBranchId,
      });

      if (res.success) {
        setThreads(res.threads);
        setOpenCount(res.openCount);
      } else {
        setError(res.error || "Failed to load session reason inbox.");
      }
    } catch {
      setError("An unexpected error occurred while loading reason inbox.");
    } finally {
      setLoading(false);
    }
  }, [selectedDate, activeBranchId]);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  const openThread = async (item: AdminReasonInboxItem) => {
    setSelectedThreadSummary(item);
    setReplyText("");
    setActionError(null);
    setLoadingThread(true);

    try {
      const res = await getThreadForCaseTodayAction(item.caseId, selectedDate);
      if (res.success && res.data) {
        setThreadDetails(res.data);
        if (item.hasUnread) {
          await markThreadReadAction({ threadId: item.threadId });
          // Update item in local list
          setThreads((prev) =>
            prev.map((t) =>
              t.threadId === item.threadId ? { ...t, hasUnread: false } : t
            )
          );
        }
      } else {
        setActionError(res.error || "Failed to open thread details.");
      }
    } catch {
      setActionError("Failed to open thread details.");
    } finally {
      setLoadingThread(false);
    }
  };

  const closeThread = () => {
    setSelectedThreadSummary(null);
    setThreadDetails(null);
    setReplyText("");
    setActionError(null);
    loadInbox();
    onRefreshNeeded?.();
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedThreadSummary) return;
    const clean = replyText.trim();
    if (!clean) return;

    setReplying(true);
    setActionError(null);

    try {
      const res = await replyReasonMessageAction({
        threadId: selectedThreadSummary.threadId,
        body: clean,
      });

      if (res.success) {
        setReplyText("");
        // Reload thread details
        const refreshed = await getThreadForCaseTodayAction(
          selectedThreadSummary.caseId,
          selectedDate
        );
        if (refreshed.success && refreshed.data) {
          setThreadDetails(refreshed.data);
        }
        loadInbox();
        onRefreshNeeded?.();
      } else {
        setActionError(res.error || "Failed to send reply.");
      }
    } catch {
      setActionError("An unexpected error occurred while sending reply.");
    } finally {
      setReplying(false);
    }
  };

  const handleToggleResolve = async () => {
    if (!selectedThreadSummary || !threadDetails) return;
    setActionError(null);

    try {
      if (threadDetails.status === "open") {
        const res = await markThreadResolvedAction({
          threadId: selectedThreadSummary.threadId,
        });
        if (res.success) {
          setThreadDetails((prev) => (prev ? { ...prev, status: "resolved" } : null));
          loadInbox();
          onRefreshNeeded?.();
        } else {
          setActionError(res.error || "Failed to resolve thread.");
        }
      } else {
        const res = await reopenThreadAction({
          threadId: selectedThreadSummary.threadId,
        });
        if (res.success) {
          setThreadDetails((prev) => (prev ? { ...prev, status: "open" } : null));
          loadInbox();
          onRefreshNeeded?.();
        } else {
          setActionError(res.error || "Failed to reopen thread.");
        }
      }
    } catch {
      setActionError("Failed to update thread status.");
    }
  };

  return (
    <div
      data-testid="admin-reason-inbox-card"
      className="border border-slate-200 bg-white p-5 shadow-xs rounded-none space-y-4"
    >
      {/* Inbox Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Session reasons today
            </h3>
            <span
              data-testid="admin-reason-open-count"
              className="px-2 py-0.5 text-xs font-mono font-bold bg-[#0B7A63] text-white"
            >
              {openCount} open
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Explanations submitted by clinicians for unrecorded sessions on this date.
          </p>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Thread List Table / Rows */}
      {loading ? (
        <div className="p-6 text-center text-xs text-slate-400">
          Loading session reasons...
        </div>
      ) : threads.length === 0 ? (
        <div
          data-testid="admin-reason-inbox-empty"
          className="p-6 border border-dashed border-slate-200 bg-slate-50 text-center text-xs text-slate-500"
        >
          No session reasons recorded for this date and branch.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden border border-slate-200">
          {threads.map((item) => (
            <div
              key={item.threadId}
              data-testid={`admin-reason-row-${item.threadId}`}
              onClick={() => openThread(item)}
              className="p-3.5 hover:bg-slate-50 cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 select-none"
            >
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold bg-slate-900 text-white px-1.5 py-0.5">
                    {item.patientId}
                  </span>
                  <span className="text-xs font-bold text-slate-900 truncate">
                    {item.patientName}
                  </span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    <span>{item.therapistName}</span>
                  </span>
                  {item.hasUnread && (
                    <span
                      data-testid="admin-reason-unread-dot"
                      className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      <span>Unread</span>
                    </span>
                  )}
                  <span
                    className={`px-1.5 py-0.2 text-[10px] font-bold uppercase ${
                      item.status === "resolved"
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-amber-50 text-amber-800 border border-amber-200"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                {/* First line preview */}
                <p className="text-xs text-slate-700 font-medium truncate max-w-xl">
                  {item.firstLine}
                </p>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between text-[11px] text-slate-400 font-mono shrink-0">
                <span>{item.timeIST}</span>
                <span className="text-xs font-bold text-[#0B7A63] hover:underline sm:mt-1">
                  View thread &rarr;
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admin Thread Drawer / Modal */}
      {selectedThreadSummary && (
        <div
          data-testid="admin-reason-thread-modal"
          className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end"
        >
          <div className="w-full sm:max-w-xl md:max-w-2xl bg-white h-dvh shadow-2xl flex flex-col border-l-2 border-slate-900 overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold bg-slate-900 text-white px-2 py-0.5">
                    {selectedThreadSummary.patientId}
                  </span>
                  <span className="text-sm font-bold text-slate-900 tracking-tight">
                    {selectedThreadSummary.patientName}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Clinician: {selectedThreadSummary.therapistName} • Date: {selectedDate}
                </p>
              </div>

              <button
                type="button"
                data-testid="close-admin-reason-modal"
                onClick={closeThread}
                aria-label="Close thread"
                className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer rounded-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status & Resolve bar */}
            <div className="px-6 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className="text-slate-600 uppercase text-[11px] font-bold">Status:</span>
                <span
                  data-testid="admin-thread-status"
                  className={`px-2 py-0.5 text-xs font-bold uppercase ${
                    threadDetails?.status === "resolved"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {threadDetails?.status || selectedThreadSummary.status}
                </span>
              </div>

              {threadDetails?.status === "resolved" ? (
                <button
                  type="button"
                  data-testid="admin-reopen-thread-btn"
                  onClick={handleToggleResolve}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-none cursor-pointer inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reopen thread</span>
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="admin-resolve-thread-btn"
                  onClick={handleToggleResolve}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold uppercase tracking-wider rounded-none cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Mark resolved</span>
                </button>
              )}
            </div>

            {/* Error in modal */}
            {actionError && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            {/* Conversation Messages */}
            <div className="flex-1 p-6 space-y-3 overflow-y-auto">
              {loadingThread ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Loading conversation history...
                </div>
              ) : threadDetails?.messages.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No messages found in this thread.
                </div>
              ) : (
                threadDetails?.messages.map((m) => (
                  <div
                    key={m.id}
                    data-testid={`admin-thread-msg-${m.id}`}
                    className={`p-3.5 border rounded-none ${
                      m.authorRole === "admin"
                        ? "bg-[#E8F5F1] border-[#0B7A63]/30 ml-4 sm:ml-8"
                        : "bg-white border-slate-200 mr-4 sm:mr-8 shadow-xs"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-bold text-slate-900">
                        {m.authorRole === "admin" ? `Admin (${m.authorName})` : m.authorName}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {m.formattedTimeIST}
                      </span>
                    </div>

                    <p className="text-xs text-slate-800 whitespace-pre-wrap break-words leading-relaxed">
                      {m.body}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Reply Form */}
            {threadDetails?.status === "resolved" ? (
              <div className="p-4 bg-slate-100 border-t border-slate-200 text-center text-xs text-slate-500 font-medium">
                This thread is marked resolved. Reopen to send a reply.
              </div>
            ) : threadDetails?.isLockedMidnight ? (
              <div className="p-4 bg-slate-100 border-t border-slate-200 text-center text-xs text-slate-500 font-medium">
                Past midnight IST. This thread is now read-only.
              </div>
            ) : (
              <form
                onSubmit={handleSendReply}
                data-testid="admin-reply-form"
                className="p-6 bg-slate-50 border-t border-slate-200 space-y-2.5"
              >
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Reply to clinician <span className="text-red-500">*</span>
                </label>

                <textarea
                  data-testid="admin-reply-input"
                  rows={3}
                  maxLength={1000}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type an administrative reply to the therapist..."
                  className="w-full border border-slate-300 p-3 text-xs focus:outline-none focus:border-[#0B7A63] rounded-none bg-white font-medium resize-none"
                  disabled={replying}
                />

                <div className="flex items-center justify-between text-[11px] text-slate-500 px-0.5">
                  <span data-testid="admin-reply-char-counter">
                    {replyText.length} / 1000 characters
                  </span>
                </div>

                <button
                  type="submit"
                  data-testid="admin-send-reply-btn"
                  disabled={replying || !replyText.trim()}
                  className="w-full min-h-[48px] bg-[#0B7A63] hover:bg-[#086350] disabled:bg-slate-300 text-white text-xs font-bold uppercase tracking-wider rounded-none shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer touch-manipulation select-none"
                >
                  <Send className="w-4 h-4" />
                  <span>{replying ? "Sending reply..." : "Send reply"}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

