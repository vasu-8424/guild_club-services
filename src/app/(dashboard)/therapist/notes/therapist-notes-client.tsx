"use client";

import * as React from "react";
import { Icons } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import {
  type AdminNoteItem,
  markNoteReadAction,
} from "@/lib/actions/admin-notes-actions";

interface TherapistNotesClientProps {
  initialNotes: AdminNoteItem[];
}

export function TherapistNotesClient({
  initialNotes,
}: TherapistNotesClientProps) {
  const [notes, setNotes] = React.useState<AdminNoteItem[]>(initialNotes);
  const [readingId, setReadingId] = React.useState<string | null>(null);

  const handleMarkAsRead = async (noteId: string) => {
    setReadingId(noteId);
    try {
      const res = await markNoteReadAction(noteId);
      if (res.success) {
        setNotes((prev) =>
          prev.map((n) =>
            n.id === noteId
              ? {
                  ...n,
                  isRead: true,
                  readAt: new Date().toISOString(),
                  formattedReadAt: "Just now",
                }
              : n
          )
        );
      }
    } catch {
      // silent
    } finally {
      setReadingId(null);
    }
  };

  const unreadCount = notes.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6" data-testid="therapist-notes-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider text-slate-900">
            Notes from Admin
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Administrative notices and clinical instructions directed to you.
          </p>
        </div>
        {unreadCount > 0 && (
          <span
            data-testid="unread-notes-indicator"
            className="inline-flex items-center px-2.5 py-1 text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 rounded-none"
          >
            {unreadCount} Unread {unreadCount === 1 ? "Note" : "Notes"}
          </span>
        )}
      </div>

      {/* Notes List */}
      {notes.length === 0 ? (
        <div
          data-testid="no-notes-message"
          className="border border-slate-200 bg-white p-12 text-center rounded-none shadow-xs space-y-2"
        >
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-none bg-slate-100 text-slate-400">
            <Icons.Envelope className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-slate-800">
            No administrative notes yet.
          </p>
          <p className="text-xs text-slate-500">
            When administrators or clinic leaders send you a note, it will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4" data-testid="notes-list">
          {notes.map((note) => (
            <div
              key={note.id}
              data-testid={`note-card-${note.id}`}
              onClick={() => {
                if (!note.isRead) handleMarkAsRead(note.id);
              }}
              className={`border p-5 rounded-none shadow-xs transition-all ${
                note.isRead
                  ? "border-slate-200 bg-white"
                  : "border-[#0B7A63]/40 bg-emerald-50/30 ring-1 ring-[#0B7A63]/20"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-none ${
                      note.isRead
                        ? "bg-slate-100 text-slate-600"
                        : "bg-[#0B7A63] text-white"
                    }`}
                  >
                    <Icons.Envelope className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      {note.fromUserName}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500">
                      {note.formattedCreatedAt}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {note.isRead ? (
                    <span
                      data-testid={`read-badge-${note.id}`}
                      className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 uppercase tracking-wider rounded-none"
                    >
                      Read {note.formattedReadAt ? `(${note.formattedReadAt})` : ""}
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span
                        data-testid={`unread-badge-${note.id}`}
                        className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 uppercase tracking-wider rounded-none"
                      >
                        New / Unread
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={readingId === note.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsRead(note.id);
                        }}
                        data-testid={`mark-read-btn-${note.id}`}
                      >
                        {readingId === note.id ? "Marking..." : "Mark as read"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Note Content */}
              <div className="pt-3">
                <p className="text-xs text-slate-900 font-sans leading-relaxed whitespace-pre-wrap">
                  {note.message}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400 italic">
                Direct administrative communication. Replies are not enabled in this version.
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
