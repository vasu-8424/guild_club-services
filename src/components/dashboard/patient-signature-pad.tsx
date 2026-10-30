"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";

interface PatientSignaturePadProps {
  onSignatureChange: (dataUrl: string | null) => void;
  disabled?: boolean;
  existingSignatureUrl?: string | null;
}

interface Point {
  x: number;
  y: number;
}

export function PatientSignaturePad({
  onSignatureChange,
  disabled = false,
  existingSignatureUrl = null,
}: PatientSignaturePadProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [hasDrawn, setHasDrawn] = React.useState(false);
  const [history, setHistory] = React.useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = React.useState(-1);

  // Initialize canvas
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    // Set high-DPI scaling
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.strokeStyle = "#0f172a"; // slate-900
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Save initial blank state
    const blankState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory([blankState]);
    setHistoryIndex(0);
  }, []);

  const saveCanvasState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(currentState);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setHasDrawn(true);
    onSignatureChange(canvas.toDataURL("image/png"));
  };

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // pointer capture might fail in tests/virtual pointers
    }
    setIsDrawing(true);

    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // pointer may already be released
      }
    }
    setIsDrawing(false);
    saveCanvasState();
  };

  const handleClear = () => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (history.length > 0 && history[0]) {
      ctx.putImageData(history[0], 0, 0);
    }

    setHasDrawn(false);
    onSignatureChange(null);
  };

  const handleRedo = () => {
    if (disabled || historyIndex >= history.length - 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const nextIndex = historyIndex + 1;
    const nextState = history[nextIndex];
    if (nextState) {
      ctx.putImageData(nextState, 0, 0);
      setHistoryIndex(nextIndex);
      setHasDrawn(true);
      onSignatureChange(canvas.toDataURL("image/png"));
    }
  };

  if (existingSignatureUrl) {
    return (
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-slate-700">
          Patient sign
        </label>
        <div className="relative rounded-none border border-slate-200 bg-white p-3 flex items-center justify-center min-h-[120px] shadow-xs">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={existingSignatureUrl}
            alt="Patient Signature"
            data-testid="signature-preview"
            className="max-h-[100px] object-contain"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-700">
          Patient sign
        </label>
        {!disabled && (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="signature-clear-button"
              className="h-7 px-2 text-[11px] text-slate-600 hover:text-slate-900"
              onClick={handleClear}
              disabled={!hasDrawn}
            >
              <Icons.Trash className="h-3 w-3 mr-1" />
              Clear
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="signature-redo-button"
              className="h-7 px-2 text-[11px] text-slate-600 hover:text-slate-900"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
            >
              <Icons.Redo className="h-3 w-3 mr-1" />
              Redo
            </Button>
          </div>
        )}
      </div>

      <div
        className={`relative rounded-none border bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)] overflow-hidden transition-all ${
          disabled
            ? "border-slate-200 opacity-80 cursor-not-allowed"
            : "border-slate-300 hover:border-[#0B7A63] focus-within:ring-1 focus-within:ring-[#0B7A63]"
        }`}
      >
        <canvas
          ref={canvasRef}
          data-testid="patient-signature-canvas"
          className="h-32 w-full touch-none cursor-crosshair bg-white"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        {!hasDrawn && !disabled && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400 select-none">
            Sign here with finger, stylus, or mouse
          </div>
        )}
      </div>
    </div>
  );
}
