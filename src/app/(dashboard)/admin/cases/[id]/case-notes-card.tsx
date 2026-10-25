"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { addNoteAction } from "@/lib/actions/case-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, Send, AlertCircle, CheckCircle } from "lucide-react";
import { Icons } from "@/components/ui/icons";

interface NoteItem {
  id: string;
  note: string;
  createdAt: Date;
  authorName: string;
  authorRole: string;
}

interface CaseNotesCardProps {
  caseId: string;
  notes: NoteItem[];
}

export function CaseNotesCard({ caseId, notes }: CaseNotesCardProps) {
  const router = useRouter();
  const [newNote, setNewNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newNote.trim().length < 10) {
      setError("Note must be at least 10 characters long.");
      return;
    }

    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const res = await addNoteAction({
        caseId,
        note: newNote,
        isPrivate: false,
      });

      if (!res.success) {
        setError(res.error ?? "Failed to add note");
      } else {
        setSuccess("Note added successfully.");
        setNewNote("");
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-emerald-600" />
          <CardTitle className="text-base">Clinical & Case Notes</CardTitle>
        </div>
        <CardDescription className="text-xs">
          {notes.length} documented note{notes.length === 1 ? "" : "s"} on file.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-6">
        {/* Existing notes list */}
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {notes.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">
              No notes have been added to this case yet.
            </p>
          ) : (
            notes.map((n) => (
              <div
                key={n.id}
                data-testid="note-item"
                className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-1.5 text-xs text-slate-800"
              >
                <div className="flex items-center justify-between text-slate-500 text-[11px]">
                  <span className="font-semibold text-slate-700">
                    {n.authorName} ({n.authorRole.replace("_", " ")})
                  </span>
                  <span>
                    {new Date(n.createdAt).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-slate-700 leading-relaxed">
                  {n.note}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Add note form */}
        <form onSubmit={handleAddNote} className="space-y-3 pt-4 border-t border-slate-100">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            Add New Note
          </h4>

          {error && (
            <div data-testid="note-error-message" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div data-testid="note-success-message" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800">
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <Textarea
            data-testid="note-input"
            placeholder="Type your clinical observation, intake update, or progress remarks (min 10 chars)..."
            rows={3}
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            required
          />

          <Button
            data-testid="note-submit-button"
            type="submit"
            size="sm"
            leadingIcon={<Icons.ArrowRight />}
            isLoading={isLoading}
          >
            Post Note
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
