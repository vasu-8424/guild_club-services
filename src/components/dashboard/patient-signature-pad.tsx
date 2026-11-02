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
    const width = rect.width || 360;
    const height = 240;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Initial crisp white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#0f172a"; // slate-900
    ctx.lineWidth = 3;
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
    setHistory([...newHistory, currentState]);
    setHistoryIndex(newHistory.length);
  };

  const getCoordinates = (
    e: React.PointerEvent<HTMLCanvasElement>
  ): Point => {
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
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const point = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const point = getCoordinates(e);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture release fails
    }
    setIsDrawing(false);
    saveCanvasState();
    setHasDrawn(true);

    const canvas = canvasRef.current;
    if (canvas) {
      onSignatureChange(canvas.toDataURL("image/png"));
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width || 360, 240);

    const blankState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory([blankState]);
    setHistoryIndex(0);
    setHasDrawn(false);
    onSignatureChange(null);
  };

  const handleUndo = () => {
    if (historyIndex <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const prevIndex = historyIndex - 1;
    const prevState = history[prevIndex];
    ctx.putImageData(prevState, 0, 0);
    setHistoryIndex(prevIndex);

    if (prevIndex === 0) {
      setHasDrawn(false);
      onSignatureChange(null);
    } else {
      setHasDrawn(true);
      onSignatureChange(canvas.toDataURL("image/png"));
    }
  };

  if (existingSignatureUrl) {
    return (
      <div className="space-y-2">
        <label className="block text-[14px] font-semibold tracking-wide uppercase text-slate-700">
          Patient Signature
        </label>
        <div className="relative rounded-none border border-slate-200 bg-white p-4 flex items-center justify-center min-h-[240px] shadow-xs">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={existingSignatureUrl}
            alt="Patient Signature"
            data-testid="signature-preview"
            className="max-h-[200px] object-contain"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 w-full">
      <div className="flex items-center justify-between">
        <label className="block text-[14px] font-semibold tracking-wide uppercase text-slate-700">
          Patient Signature
        </label>
        {!disabled && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="signature-undo-button"
              className="min-h-[44px] h-[44px] px-3 text-[13px] text-slate-700 hover:text-slate-900"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
            >
              <Icons.Undo className="h-4 w-4 mr-1.5" />
              Undo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="signature-clear-button"
              className="min-h-[44px] h-[44px] px-3 text-[13px] text-rose-700 hover:text-rose-800"
              onClick={handleClear}
              disabled={!hasDrawn}
            >
              <Icons.Trash className="h-4 w-4 mr-1.5" />
              Clear
            </Button>
          </div>
        )}
      </div>

      <div
        className={`relative w-full rounded-none border bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)] overflow-hidden transition-all ${
          disabled
            ? "border-slate-200 opacity-80 cursor-not-allowed"
            : "border-slate-300 hover:border-[#0B7A63] focus-within:ring-1 focus-within:ring-[#0B7A63]"
        }`}
      >
        <canvas
          ref={canvasRef}
          data-testid="patient-signature-canvas"
          className="h-[240px] min-h-[240px] w-full cursor-crosshair bg-white touch-none"
          style={{ touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        {!hasDrawn && !disabled && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[14px] font-medium text-slate-400 select-none">
            Sign here with finger or stylus
          </div>
        )}
      </div>
    </div>
  );
}
