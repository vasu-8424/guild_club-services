"use client";

import Image from "next/image";
import Link from "next/link";
import { Icons } from "@/components/ui/icons";

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md bg-white border border-slate-200 shadow-sm p-6 sm:p-8 text-center">
        {/* Brand Emblem */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full overflow-hidden shadow-md border-2 border-amber-500/30 bg-slate-900 mb-4">
          <Image
            src="/logo.png"
            alt="Guild Club Services"
            width={80}
            height={80}
            priority
            className="h-full w-full object-cover"
          />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Guild Club Services
        </h1>
        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mt-1">
          Clinical Case Management Portal
        </p>

        {/* Version Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold mt-4">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>Release v1.2 • Fresh Build</span>
        </div>

        {/* Big Download Button */}
        <div className="mt-6">
          <a
            href="/guild-club-services-v2.apk"
            download="guild-club-services-v2.apk"
            className="w-full flex items-center justify-center gap-2 py-3.5 px-6 bg-[#0B7A63] hover:bg-[#096350] active:bg-[#074d3e] text-white font-semibold text-base transition-colors shadow-sm"
          >
            <Icons.Download className="h-5 w-5" />
            <span>Download Android APK (v1.2)</span>
          </a>
          <p className="text-[11px] text-slate-400 mt-2">
            File size: ~7.5 MB • Direct secure download
          </p>
        </div>

        {/* Instructions */}
        <div className="mt-6 pt-5 border-t border-slate-100 text-left space-y-3">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Installation Steps:
          </h2>
          <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside pl-1">
            <li>
              If you have an older APK in your phone’s <strong>Downloads</strong> folder, delete it first to avoid confusion.
            </li>
            <li>
              Tap the green <strong>Download Android APK</strong> button above.
            </li>
            <li>
              When the download finishes, tap <strong>guild-club-services-v2.apk</strong> to open the installer.
            </li>
            <li>
              Tap <strong>Install</strong> (or <strong>Update</strong>). Once installed, open the app and grant Location & Camera permissions when prompted.
            </li>
          </ol>
        </div>

        {/* Web Link */}
        <div className="mt-6 pt-4 border-t border-slate-100">
          <Link
            href="/login"
            className="text-xs font-medium text-[#0B7A63] hover:underline"
          >
            ← Or continue to Web Portal in browser
          </Link>
        </div>
      </div>
    </div>
  );
}
