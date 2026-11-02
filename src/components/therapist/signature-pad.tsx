"use client";

import React, { useRef, useState, useEffect } from "react";
import { RotateCcw, PenTool, Trash2 } from "lucide-react";

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void;
  initialSignatureUrl?: string | null;
  readOnly?: boolean;
}

export function SignaturePad({
  onChange,
  initialSignatureUrl,
  readOnly = false,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    // Set canvas dimensions
    const width = canvas.offsetWidth || 360;
    const height = 240;
    canvas.width = width;
    canvas.height = height;

    // Fill white background so exported PNG is crisp
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (initialSignatureUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        setHasDrawn(true);
      };
      img.src = initialSignatureUrl;
    } else {
      const blank = ctx.getImageData(0, 0, width, height);
      setHistory([blank]);
      setHistoryIndex(0);
    }
  }, [initialSignatureUrl]);

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
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (readOnly) return;
    if ("touches" in e && e.cancelable) {
      e.preventDefault();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing || readOnly) return;
    if ("touches" in e && e.cancelable) {
      e.preventDefault();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setHasDrawn(true);
    saveCanvasState();

    const canvas = canvasRef.current;
    if (canvas) {
      onChange(canvas.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);

    const blank = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory([blank]);
    setHistoryIndex(0);
    onChange(null);
  };

  const undo = () => {
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
      onChange(null);
    } else {
      setHasDrawn(true);
      onChange(canvas.toDataURL("image/png"));
    }
  };

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[14px] font-semibold text-stone-700 tracking-wide uppercase flex items-center gap-1.5">
          <PenTool className="w-4 h-4 text-stone-500" />
          <span>Patient Signature</span>
        </label>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={undo}
              disabled={historyIndex <= 0}
              data-testid="signature-undo-btn"
              className="min-h-[44px] h-[44px] px-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-stone-600 hover:text-stone-900 border border-stone-200 bg-white hover:bg-stone-50 rounded-none disabled:opacity-40"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
            <button
              type="button"
              onClick={clear}
              data-testid="signature-clear-btn"
              disabled={!hasDrawn}
              className="min-h-[44px] h-[44px] px-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-rose-700 hover:text-rose-800 border border-stone-200 bg-white hover:bg-stone-50 rounded-none disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        )}
      </div>

      <div className="border border-stone-300 rounded-none bg-white relative overflow-hidden shadow-xs">
        <canvas
          ref={canvasRef}
          data-testid="signature-canvas"
          className="w-full h-[240px] min-h-[240px] cursor-crosshair bg-white touch-none"
          style={{ touchAction: "none" }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasDrawn && !readOnly && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-[14px] text-stone-400 font-medium">
            Sign here with finger or stylus
          </div>
        )}
      </div>
    </div>
  );
}
