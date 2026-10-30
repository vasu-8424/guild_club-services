"use client";

import React, { useRef, useState, useEffect } from "react";
import { RotateCcw, PenTool } from "lucide-react";

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = canvas.offsetWidth || 360;
    canvas.height = 140;

    // Fill white background so exported PNG is crisp
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (initialSignatureUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasDrawn(true);
      };
      img.src = initialSignatureUrl;
    }
  }, [initialSignatureUrl]);

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
    const ctx = canvas.getContext("2d");
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
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = (
    e?: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if ("touches" in (e || {}) && (e as any)?.cancelable) {
      (e as any).preventDefault();
    }
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Export PNG
    const dataUrl = canvas.toDataURL("image/png");
    onChange(dataUrl);
  };

  const clearCanvas = () => {
    if (readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
          <PenTool className="w-3.5 h-3.5 text-stone-600" />
          <span>Patient Signature <span className="text-red-500">*</span></span>
        </label>
        {!readOnly && (
          <button
            type="button"
            data-testid="clear-signature-btn"
            onClick={clearCanvas}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-600 hover:text-stone-900 border border-stone-300 hover:border-stone-400 bg-stone-50 px-2 py-0.5 rounded-none transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      <div className="border-2 border-stone-800 bg-white shadow-inner relative touch-none">
        <canvas
          ref={canvasRef}
          data-testid="signature-pad"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className={`w-full block bg-white ${readOnly ? "cursor-not-allowed" : "cursor-crosshair"}`}
          style={{ height: "140px", touchAction: "none" }}
        />
        {!hasDrawn && !readOnly && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-xs text-stone-400 font-sans tracking-wide">
            Sign with finger, stylus, or mouse here
          </div>
        )}
      </div>
      <p className="text-[10px] text-stone-500">
        Saved securely as private clinical record (PNG under 500 KB).
      </p>
    </div>
  );
}
