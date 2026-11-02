"use client";

import * as React from "react";
import { Icons } from "@/components/ui/icons";

export function InstallPromptCard() {
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
  const [showPrompt, setShowPrompt] = React.useState(false);
  const [isIOS, setIsIOS] = React.useState(false);
  const [isIOSSafari, setIsIOSSafari] = React.useState(false);

  React.useEffect(() => {
    // Check if dismissed before
    if (typeof window === "undefined") return;
    const dismissed = localStorage.getItem("pwa_install_dismissed");
    if (dismissed === "true") return;

    // Detect iOS
    const ua = window.navigator.userAgent;
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isStandalone = (window.navigator as any).standalone || window.matchMedia("(display-mode: standalone)").matches;

    if (isIOSDevice && !isStandalone) {
      setIsIOS(true);
      const isSafari = !/CriOS|FxiOS|EdgiOS/.test(ua) && /Safari/.test(ua);
      setIsIOSSafari(isSafari);
      setShowPrompt(true);
      return;
    }

    // Android / Chromium
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("pwa_install_dismissed", "true");
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
      localStorage.setItem("pwa_install_dismissed", "true");
    }
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <div
      data-testid="pwa-install-card"
      className="border border-[#0B7A63]/30 bg-white p-4 mb-3 shadow-[0_2px_8px_rgba(11,122,99,0.08)] rounded-none relative select-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 bg-[#0B7A63] text-white flex items-center justify-center rounded-none font-bold text-xs uppercase shadow-xs">
            GC
          </div>
          <div className="space-y-1">
            <h4 className="text-[14px] font-semibold text-slate-900 leading-tight">
              Install Guild Club App
            </h4>
            {isIOS ? (
              isIOSSafari ? (
                <p className="text-[13px] text-slate-600 leading-normal">
                  Tap <span className="font-semibold text-slate-900">Share</span> (the box with arrow), then choose <span className="font-semibold text-slate-900">&quot;Add to Home Screen&quot;</span>.
                </p>
              ) : (
                <p className="text-[13px] text-slate-600 leading-normal">
                  Chrome on iPhone cannot install web apps. Please open in <span className="font-semibold text-slate-900">Safari</span> to add to your Home Screen.
                </p>
              )
            ) : (
              <p className="text-[13px] text-slate-600 leading-normal">
                Install for quick access and full-screen mobile clinic management.
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          data-testid="pwa-dismiss-button"
          onClick={handleDismiss}
          className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
          aria-label="Dismiss install banner"
        >
          <Icons.Close className="h-4 w-4" />
        </button>
      </div>

      {!isIOS && deferredPrompt && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleDismiss}
            className="min-h-[44px] px-3 text-[13px] font-semibold text-slate-600 hover:text-slate-900 rounded-none cursor-pointer"
          >
            Not Now
          </button>
          <button
            type="button"
            onClick={handleInstallClick}
            data-testid="pwa-install-button"
            className="min-h-[44px] px-4 bg-[#0B7A63] hover:bg-[#086350] active:bg-[#064e3e] text-white text-[13px] font-semibold uppercase tracking-wider rounded-none cursor-pointer shadow-xs select-none touch-manipulation"
          >
            Install App
          </button>
        </div>
      )}
    </div>
  );
}
