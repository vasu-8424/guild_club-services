import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="max-w-md w-full bg-white border border-slate-300 p-8 shadow-xs text-center space-y-4">
        <div className="inline-flex items-center justify-center h-12 w-12 bg-amber-50 border border-amber-200 text-amber-700">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold uppercase tracking-wider text-slate-900">
          Page Not Found
        </h1>
        <p className="text-xs text-slate-600 leading-relaxed">
          The requested page or record could not be found, or you do not have permission to view it in the currently active branch.
        </p>
        <div className="pt-2">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-[#0B7A63] text-white hover:bg-[#096350] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Portal</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

