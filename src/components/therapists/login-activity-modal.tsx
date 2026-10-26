"use client";

import * as React from "react";
import {
  getTherapistLoginHistoryAction,
  type FormattedLoginRecord,
} from "@/lib/actions/location-actions";
import { Icons } from "@/components/ui/icons";
import { ExternalLink, MapPin, X } from "lucide-react";

interface LoginActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  therapistId: string;
  therapistName: string;
}

export function LoginActivityModal({
  isOpen,
  onClose,
  therapistId,
  therapistName,
}: LoginActivityModalProps) {
  const [loading, setLoading] = React.useState(true);
  const [records, setRecords] = React.useState<FormattedLoginRecord[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    getTherapistLoginHistoryAction(therapistId)
      .then((res) => {
        if (!mounted) return;
        if (res.success) {
          setRecords(res.records);
        } else {
          setError(res.error || "Failed to load login history.");
        }
      })
      .catch(() => {
        if (mounted) setError("Failed to load login history.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, therapistId]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="login-activity-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="bg-white border-2 border-stone-900 w-full max-w-4xl shadow-2xl rounded-none my-8 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-800 border border-emerald-300">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 uppercase tracking-tight">
                Login Activity: {therapistName}
              </h3>
              <p className="text-xs text-stone-500">
                Audit trail of sign-ins, timestamps, and captured coordinates
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-stone-500 hover:text-stone-900 transition-colors"
            data-testid="close-login-activity-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-stone-500 text-sm">
              <Icons.Spinner className="w-5 h-5 animate-spin mr-2" />
              Loading login activity...
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 text-stone-500 text-sm">
              No login activity recorded yet for this practitioner.
            </div>
          ) : (
            <div className="border border-stone-200 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-100 border-b border-stone-200 text-stone-700 uppercase font-semibold">
                    <th className="py-3 px-3">Login Time (IST)</th>
                    <th className="py-3 px-3">Logout Time (IST)</th>
                    <th className="py-3 px-3">Duration</th>
                    <th className="py-3 px-3">Location Status</th>
                    <th className="py-3 px-3">Accuracy</th>
                    <th className="py-3 px-3">Map Location</th>
                    <th className="py-3 px-3">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 font-mono text-stone-800">
                  {records.map((r) => (
                    <tr
                      key={r.id}
                      data-testid="login-activity-row"
                      className="hover:bg-stone-50 transition-colors"
                    >
                      <td className="py-3 px-3 font-sans font-medium text-stone-900">
                        {r.formattedLoggedInAt}
                      </td>
                      <td className="py-3 px-3 font-sans text-stone-700">
                        {r.formattedLoggedOutAt ? (
                          r.formattedLoggedOutAt
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-sans font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active session
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-sans text-stone-700">
                        {r.duration || "—"}
                      </td>
                      <td className="py-3 px-3">
                        {r.locationStatus === "captured" ? (
                          <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-sans font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Captured
                          </span>
                        ) : r.locationStatus === "denied" ? (
                          <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-sans font-semibold bg-red-100 text-red-800 border border-red-300">
                            Denied
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-sans font-semibold bg-stone-100 text-stone-700 border border-stone-300">
                            Unavailable
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {r.accuracyMeters !== null
                          ? `±${r.accuracyMeters} m`
                          : "—"}
                      </td>
                      <td className="py-3 px-3">
                        {r.mapUrl ? (
                          <a
                            href={r.mapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid="open-in-map-link"
                            className="inline-flex items-center gap-1 text-[#0B7A63] hover:underline font-sans font-semibold"
                          >
                            <span>Open in map</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <span className="text-stone-400 font-sans">
                            No coordinates
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-stone-600">
                        {r.ipAddress || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-stone-200 bg-stone-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-stone-400 text-stone-700 hover:bg-stone-100 text-xs font-semibold uppercase tracking-wider rounded-none"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
