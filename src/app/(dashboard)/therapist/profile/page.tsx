import React from "react";
import { requireRole } from "@/lib/session";
import { db } from "@/db";
import { users, therapistProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getTherapistLoginHistoryAction } from "@/lib/actions/location-actions";
import { User, MapPin, Calendar, Clock, ExternalLink, Shield } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export const metadata = {
  title: "My Profile | Guild Club Services",
};

export default async function TherapistProfilePage() {
  const currentUser = await requireRole("therapist");

  const [therapist] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      specialization: therapistProfiles.specialization,
      experienceYears: therapistProfiles.experienceYears,
    })
    .from(users)
    .leftJoin(therapistProfiles, eq(therapistProfiles.userId, users.id))
    .where(eq(users.id, currentUser.id))
    .limit(1);

  const historyResult = await getTherapistLoginHistoryAction(currentUser.id);
  const loginRecords = historyResult.success ? historyResult.records : [];

  return (
    <DashboardShell user={currentUser} title="My Profile">
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="border-b border-stone-200 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 uppercase">
          Therapist Profile
        </h1>
        <p className="text-xs text-stone-500 mt-1">
          Personal details, credentials, and recent login activity
        </p>
      </div>

      {/* Practitioner Summary Card */}
      <div className="bg-white border border-stone-200 p-6 rounded-none shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#0B7A63] text-white flex items-center justify-center font-bold text-xl rounded-none">
              {therapist?.name?.charAt(0)?.toUpperCase() || "T"}
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900 tracking-tight">
                {therapist?.name}
              </h2>
              <p className="text-xs text-stone-500">{therapist?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Therapist
                </span>
                {therapist?.specialization && (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                    {therapist.specialization}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="text-xs text-stone-500 space-y-1 sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-stone-100">
            {therapist?.experienceYears !== undefined && (
              <p>Experience: <strong className="text-stone-800 font-semibold">{therapist.experienceYears} Years</strong></p>
            )}
            {therapist?.phone && (
              <p>Contact: <strong className="text-stone-800 font-semibold">{therapist.phone}</strong></p>
            )}
          </div>
        </div>
      </div>

      {/* Login History Section */}
      <div className="bg-white border border-stone-200 rounded-none shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-800" />
            <h3 className="text-sm font-bold uppercase tracking-tight text-stone-900">
              My Login History
            </h3>
          </div>
          <span className="text-xs text-stone-500">
            Showing latest {loginRecords.length} sessions
          </span>
        </div>

        {loginRecords.length === 0 ? (
          <div className="p-8 text-center text-xs text-stone-500">
            No login history recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                {loginRecords.map((record) => (
                  <tr
                    key={record.id}
                    data-testid="therapist-login-history-row"
                    className="hover:bg-stone-50 transition-colors"
                  >
                    <td className="py-3 px-3 font-sans font-medium text-stone-900">
                      {record.formattedLoggedInAt}
                    </td>
                    <td className="py-3 px-3 font-sans text-stone-700">
                      {record.formattedLoggedOutAt ? (
                        record.formattedLoggedOutAt
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-sans font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Active session
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-sans text-stone-700">
                      {record.duration || "—"}
                    </td>
                    <td className="py-3 px-3 font-sans">
                      {record.locationStatus === "captured" ? (
                        <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Captured
                        </span>
                      ) : record.locationStatus === "denied" ? (
                        <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold bg-red-100 text-red-800 border border-red-300">
                          Denied
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold bg-stone-100 text-stone-700 border border-stone-300">
                          Unavailable
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {record.accuracyMeters !== null
                        ? `±${record.accuracyMeters} m`
                        : "—"}
                    </td>
                    <td className="py-3 px-3 font-sans">
                      {record.mapUrl ? (
                        <a
                          href={record.mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#0B7A63] hover:underline font-semibold"
                        >
                          <span>Open in map</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-stone-400">No coordinates</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-stone-600">
                      {record.ipAddress || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </DashboardShell>
  );
}
