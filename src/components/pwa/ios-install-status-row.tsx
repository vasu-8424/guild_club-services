"use client";

import * as React from "react";
import { Smartphone, CheckCircle, Info } from "lucide-react";

export function IosInstallStatusRow() {
  const [platformInfo, setPlatformInfo] = React.useState<{
    isIOS: boolean;
    isStandalone: boolean;
  }>({ isIOS: false, isStandalone: false });
  const [showModal, setShowModal] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return;

    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    setPlatformInfo({ isIOS, isStandalone });
  }, []);

  if (!platformInfo.isIOS) return null;

  return (
    <>
      <div className="pt-2 flex items-center justify-between text-[13px] text-stone-700">
        <div className="flex items-center gap-1.5">
          <Smartphone className="w-4 h-4 text-stone-400" />
          <span className="font-medium text-stone-500">iPhone App Mode</span>
        </div>
        {platformInfo.isStandalone ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-none">
            <CheckCircle className="w-3 h-3 text-emerald-600" />
            Home Screen
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold text-[#0B7A63] bg-teal-50 border border-[#0B7A63]/30 rounded-none hover:bg-teal-100 transition-colors cursor-pointer"
          >
            <Info className="w-3 h-3" />
            Install to Home Screen
          </button>
        )}
      </div>

      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
        >
          <div className="w-full max-w-sm border border-stone-300 bg-white p-5 shadow-2xl rounded-none space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h4 className="text-sm font-bold text-stone-900">
                Install on iPhone
              </h4>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-stone-400 hover:text-stone-600 text-lg leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>
            <p className="text-xs text-stone-600">
              You can run Guild Club directly as an app on your iPhone without using the App Store:
            </p>
            <ol className="list-decimal pl-5 space-y-2 text-xs text-stone-700">
              <li>
                In <strong>Safari</strong>, tap the <strong>Share</strong> button at the bottom of the screen.
              </li>
              <li>
                Scroll down and tap <strong>Add to Home Screen</strong>.
              </li>
              <li>
                Tap <strong>Add</strong> at the top-right corner.
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="w-full bg-[#0B7A63] text-white py-2 text-xs font-semibold rounded-none hover:bg-[#096652] transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

