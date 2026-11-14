"use client";

import * as React from "react";
import { Capacitor } from "@capacitor/core";
import { Share, PlusSquare, X, Smartphone } from "lucide-react";

export function IosInstallBanner() {
  const [showPrompt, setShowPrompt] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return;

    // Check if running inside Capacitor native shell
    if (Capacitor.isNativePlatform()) return;

    // Check if user is on iOS (iPhone, iPad, iPod)
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (!isIOS) return;

    // Check if already in standalone mode (already added to Home Screen)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) return;

    // Check if user already dismissed the prompt
    const dismissed = localStorage.getItem("gc_ios_install_dismissed");
    if (dismissed === "true") return;

    // Show prompt after a short delay so the initial page render is smooth
    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setShowPrompt(false);
    try {
      localStorage.setItem("gc_ios_install_dismissed", "true");
    } catch {
      // storage error fallback
    }
  };

  if (!showPrompt) return null;

  return (
    <div
      role="dialog"
      aria-label="Add to iPhone Home Screen"
      data-testid="ios-install-banner"
      className="fixed bottom-3 left-3 right-3 z-50 mx-auto max-w-md border border-[#0B7A63]/30 bg-white p-4 shadow-xl shadow-slate-900/15 rounded-none animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center bg-[#0B7A63] text-white rounded-none shrink-0">
            <Smartphone className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Install Guild Club on iPhone
            </h3>
            <p className="text-xs text-slate-500">
              Use as a full-screen app without the App Store
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
          aria-label="Dismiss install guide"
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-700">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center bg-slate-100 font-bold text-slate-800 rounded-none shrink-0">
            1
          </span>
          <span>
            Tap the <strong>Share</strong> button <Share className="inline h-3.5 w-3.5 text-[#0B7A63] align-text-bottom mx-0.5" /> in Safari's bottom toolbar.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center bg-slate-100 font-bold text-slate-800 rounded-none shrink-0">
            2
          </span>
          <span>
            Scroll down and tap <strong>Add to Home Screen</strong> <PlusSquare className="inline h-3.5 w-3.5 text-[#0B7A63] align-text-bottom mx-0.5" />.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center bg-slate-100 font-bold text-slate-800 rounded-none shrink-0">
            3
          </span>
          <span>
            Tap <strong>Add</strong> in the top-right corner.
          </span>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          onClick={handleDismiss}
          type="button"
          className="bg-[#0B7A63] text-white text-xs font-semibold px-3 py-1.5 rounded-none hover:bg-[#096652] active:bg-[#075342] transition-colors cursor-pointer"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

