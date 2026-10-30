"use client";

import * as React from "react";
import {
  writingAssistAction,
  isWritingAssistEnabledAction,
  type WritingSuggestion,
  type WritingAssistMode,
} from "@/lib/actions/writing-assist-actions";
import { Icons } from "@/components/ui/icons";
import { Sparkles, Check, X, RefreshCw, AlertCircle } from "lucide-react";

export interface WritingAssistProps {
  text: string;
  onApplyText: (newText: string) => void;
  context:
    | "session_note"
    | "patient_condition"
    | "progress_report"
    | "closing_summary"
    | "admin_note"
    | "general";
  knownNames?: string[];
  disabled?: boolean;
}

export function WritingAssist({
  text,
  onApplyText,
  context,
  knownNames = [],
  disabled = false,
}: WritingAssistProps) {
  const [isEnabled, setIsEnabled] = React.useState<boolean | null>(null);
  const [mode, setMode] = React.useState<WritingAssistMode>("fix_grammar");
  const [isLoading, setIsLoading] = React.useState(false);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [correctedText, setCorrectedText] = React.useState<string | null>(null);
  const [suggestions, setSuggestions] = React.useState<WritingSuggestion[]>([]);
  const [appliedSuggestions, setAppliedSuggestions] = React.useState<Set<string>>(new Set());

  // Track initial text snapshot when assist runs so edits invalidate stale results
  const [checkedSnapshot, setCheckedSnapshot] = React.useState<string>("");
  const activeAbortRef = React.useRef<AbortController | null>(null);
  const clientTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    isWritingAssistEnabledAction().then(setIsEnabled).catch(() => setIsEnabled(false));
  }, []);

  // Close panel if the user edits the field text
  React.useEffect(() => {
    if (panelOpen && text !== checkedSnapshot) {
      setPanelOpen(false);
    }
  }, [text, checkedSnapshot, panelOpen]);

  // Clean up any pending timeout or controller on unmount
  React.useEffect(() => {
    return () => {
      if (clientTimeoutRef.current) clearTimeout(clientTimeoutRef.current);
      if (activeAbortRef.current) activeAbortRef.current.abort();
    };
  }, []);

  // If writing assist is disabled via env, hide completely
  if (isEnabled === false) {
    return null;
  }

  const isButtonDisabled = disabled || isLoading || !text || text.trim().length < 10;

  const handleCancel = () => {
    if (clientTimeoutRef.current) clearTimeout(clientTimeoutRef.current);
    if (activeAbortRef.current) {
      activeAbortRef.current.abort();
      activeAbortRef.current = null;
    }
    setIsLoading(false);
    setPanelOpen(false);
    setError(null);
  };

  const handleCheckWriting = async () => {
    if (isButtonDisabled) return;

    if (activeAbortRef.current) activeAbortRef.current.abort();
    const abortController = new AbortController();
    activeAbortRef.current = abortController;

    setIsLoading(true);
    setError(null);
    setCorrectedText(null);
    setSuggestions([]);
    setAppliedSuggestions(new Set());
    setCheckedSnapshot(text);
    setPanelOpen(true);

    // 20-second client timeout
    if (clientTimeoutRef.current) clearTimeout(clientTimeoutRef.current);
    clientTimeoutRef.current = setTimeout(() => {
      if (activeAbortRef.current) {
        activeAbortRef.current.abort();
        activeAbortRef.current = null;
      }
      setIsLoading(false);
      setError("AI assistant is unavailable right now. Your text is safe.");
    }, 20000);

    try {
      const res = await writingAssistAction({
        text,
        mode,
        context,
        knownNames,
      });

      if (abortController.signal.aborted) return;

      if (res.success && res.correctedText) {
        setCorrectedText(res.correctedText);
        setSuggestions(res.suggestions || []);
      } else {
        setError(res.error || "AI assistant is unavailable right now. Your text is safe.");
      }
    } catch {
      if (!abortController.signal.aborted) {
        setError("AI assistant is unavailable right now. Your text is safe.");
      }
    } finally {
      if (clientTimeoutRef.current) clearTimeout(clientTimeoutRef.current);
      if (!abortController.signal.aborted) {
        setIsLoading(false);
      }
    }
  };

  const handleUseCorrectedText = () => {
    if (correctedText) {
      onApplyText(correctedText);
      setPanelOpen(false);
    }
  };

  const handleKeepOriginal = () => {
    setPanelOpen(false);
  };

  const toggleSuggestion = (id: string, suggestionText: string) => {
    setAppliedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // Append suggestion text as a guided note if user checks it
        onApplyText(`${text.trim()}\n[Note: ${suggestionText}]`);
      }
      return next;
    });
  };

  return (
    <div className="w-full mt-1.5 space-y-2 select-none" data-testid="writing-assist-container">
      {/* Top Action Row: Check Writing Button & Mode Toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        {/* Segmented Mode Control */}
        <div className="inline-flex items-center p-0.5 border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 gap-0.5 overflow-x-auto no-scrollbar max-w-full">
          <button
            type="button"
            data-testid="writing-mode-grammar"
            onClick={() => setMode("fix_grammar")}
            className={`px-2.5 py-1 min-h-[32px] sm:min-h-[28px] whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              mode === "fix_grammar"
                ? "bg-white text-[#0B7A63] shadow-xs font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Fix spelling & grammar
          </button>
          <button
            type="button"
            data-testid="writing-mode-suggestions"
            onClick={() => setMode("suggest_improvements")}
            className={`px-2.5 py-1 min-h-[32px] sm:min-h-[28px] whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              mode === "suggest_improvements"
                ? "bg-white text-[#0B7A63] shadow-xs font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Suggest improvements
          </button>
          <button
            type="button"
            data-testid="writing-mode-summarize"
            onClick={() => setMode("summarize")}
            className={`px-2.5 py-1 min-h-[32px] sm:min-h-[28px] whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              mode === "summarize"
                ? "bg-white text-[#0B7A63] shadow-xs font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Summarize
          </button>
          <button
            type="button"
            data-testid="writing-mode-simplify"
            onClick={() => setMode("simplify")}
            className={`px-2.5 py-1 min-h-[32px] sm:min-h-[28px] whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              mode === "simplify"
                ? "bg-white text-[#0B7A63] shadow-xs font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Simplify terms
          </button>
          <button
            type="button"
            data-testid="writing-mode-shorten"
            onClick={() => setMode("shorten")}
            className={`px-2.5 py-1 min-h-[32px] sm:min-h-[28px] whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              mode === "shorten"
                ? "bg-white text-[#0B7A63] shadow-xs font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Shorten
          </button>
        </div>

        {/* Check Writing Action Button (Minimum 44px tap target on mobile) */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {isLoading && (
            <button
              type="button"
              data-testid="cancel-writing-assist-btn"
              onClick={handleCancel}
              className="inline-flex items-center px-2.5 py-1.5 min-h-[44px] sm:min-h-[36px] bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-semibold rounded-none cursor-pointer"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            data-testid="check-writing-button"
            disabled={isButtonDisabled}
            onClick={handleCheckWriting}
            className="inline-flex items-center gap-1.5 px-3 py-2 sm:py-1.5 min-h-[44px] sm:min-h-[36px] bg-white border border-slate-300 hover:border-[#0B7A63] hover:text-[#0B7A63] text-slate-700 text-xs font-bold uppercase tracking-wider rounded-none shadow-xs transition-colors disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200"
          >
            {isLoading ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#0B7A63]" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-[#0B7A63]" />
            )}
            <span>{isLoading ? "Checking..." : "Check writing"}</span>
          </button>
        </div>
      </div>

      {/* Result Panel */}
      {panelOpen && (
        <div
          data-testid="writing-assist-panel"
          className="border border-[#0B7A63] bg-white p-3 sm:p-4 rounded-none shadow-md space-y-3"
        >
          {isLoading && (
            <div className="flex items-center justify-between gap-2.5 text-xs text-slate-600 py-3" data-testid="writing-assist-loading">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-[#0B7A63]" />
                <span className="font-semibold text-slate-700">Checking your text...</span>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                data-testid="cancel-writing-assist-btn"
                className="px-2 py-1 text-xs font-medium text-slate-600 border border-slate-300 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}

          {error && !isLoading && (
            <div
              data-testid="writing-assist-error"
              className="flex items-start gap-2 rounded-none border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
            >
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!isLoading && correctedText && (
            <div className="space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1">
                Suggested Revision
              </div>

              {/* Text Diff View */}
              <div
                data-testid="corrected-text-preview"
                className="text-xs sm:text-sm text-slate-800 bg-slate-50 border border-slate-200 p-3 rounded-none whitespace-pre-wrap leading-relaxed font-sans"
              >
                {renderHighlightedDiff(checkedSnapshot, correctedText)}
              </div>

              {/* Suggestions List (If in improvements mode) */}
              {suggestions.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Optional Clinical Improvements
                  </div>
                  <div className="space-y-1.5" data-testid="writing-suggestions-list">
                    {suggestions.map((sug) => {
                      const isChecked = appliedSuggestions.has(sug.id);
                      return (
                        <label
                          key={sug.id}
                          className="flex items-start gap-2.5 p-2 border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSuggestion(sug.id, sug.suggestion)}
                            className="h-4 w-4 rounded-none border-slate-300 text-[#0B7A63] focus:ring-[#0B7A63] mt-0.5"
                          />
                          <div className="flex-1">
                            <span className="font-semibold text-slate-900 block">{sug.suggestion}</span>
                            <span className="text-[11px] text-slate-500">{sug.reason}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Actions Button Bar */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  data-testid="cancel-writing-assist-btn"
                  onClick={handleKeepOriginal}
                  className="px-3 py-2 min-h-[44px] sm:min-h-[36px] w-full sm:w-auto text-center border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold uppercase tracking-wider rounded-none cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="keep-my-version-btn"
                  onClick={handleKeepOriginal}
                  className="px-3 py-2 min-h-[44px] sm:min-h-[36px] w-full sm:w-auto text-center border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold uppercase tracking-wider rounded-none cursor-pointer"
                >
                  Keep my version
                </button>
                <button
                  type="button"
                  data-testid="use-corrected-text-btn"
                  onClick={handleUseCorrectedText}
                  className="px-4 py-2 min-h-[44px] sm:min-h-[36px] w-full sm:w-auto bg-[#0B7A63] hover:bg-[#086350] text-white text-xs font-bold uppercase tracking-wider rounded-none cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Use corrected text</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Word-by-word diff visualizer showing deleted text struck-through and added text in emerald green
 */
function renderHighlightedDiff(original: string, updated: string): React.ReactNode {
  if (original === updated) {
    return <span>{updated}</span>;
  }

  return (
    <div className="space-y-2">
      <div className="text-slate-900 font-medium leading-relaxed">
        <span className="text-[#0B7A63] font-semibold">{updated}</span>
      </div>
      <div className="text-[11px] text-slate-500 border-t border-slate-200 pt-1.5 flex items-start gap-2">
        <span className="font-semibold text-slate-400 uppercase tracking-wider shrink-0">Original:</span>
        <span className="line-through text-slate-400 break-words">{original}</span>
      </div>
    </div>
  );
}

