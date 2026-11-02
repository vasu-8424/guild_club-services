import React from "react";
import Image from "next/image";
import { requireRole } from "@/lib/session";
import { db } from "@/db";
import { users, therapistProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getTherapistLoginHistoryAction } from "@/lib/actions/location-actions";
import { User, MapPin, Calendar, Clock, ExternalLink, Shield, Settings, HelpCircle, LogOut } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { LogoutButton } from "@/components/layout/logout-button";

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
      <div className="space-y-4 max-w-xl mx-auto pb-12 w-full">
        {/* Header */}
        <div className="border-b border-stone-200 pb-3">
          <h1 className="text-[24px] font-semibold tracking-tight text-stone-900 leading-tight">
            Therapist Profile
          </h1>
          <p className="text-[13px] text-stone-500 mt-0.5">
            Personal details, credentials, and app settings
          </p>
        </div>

        {/* Practitioner Summary Card */}
        <div className="bg-white border border-stone-200 p-4 rounded-none shadow-xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 shrink-0 bg-[#0B7A63] text-white flex items-center justify-center font-bold text-lg rounded-none shadow-xs">
              {therapist?.name?.charAt(0)?.toUpperCase() || "T"}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[18px] font-semibold text-stone-900 tracking-tight truncate">
                {therapist?.name}
              </h2>
              <p className="text-[13px] text-stone-500 truncate">{therapist?.email}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-100 text-[13px]">
            <span className="inline-flex items-center px-2 py-0.5 font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] rounded-none">
              Therapist
            </span>
            {therapist?.specialization && (
              <span className="inline-flex items-center px-2 py-0.5 font-medium bg-stone-100 text-stone-700 border border-stone-200 text-[12px] rounded-none">
                {therapist.specialization}
              </span>
            )}
            {therapist?.experienceYears !== undefined && (
              <span className="text-stone-600 text-[13px]">
                • {therapist.experienceYears} Years Exp
              </span>
            )}
            {therapist?.phone && (
              <span className="text-stone-600 text-[13px]">
                • {therapist.phone}
              </span>
            )}
          </div>
        </div>

        {/* App Settings Card */}
        <div className="bg-white border border-stone-200 rounded-none shadow-xs overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#0B7A63]" />
              <h3 className="text-[14px] font-bold uppercase tracking-wide text-stone-900">
                App Settings & System
              </h3>
            </div>
            <div className="w-6 h-6 rounded-full overflow-hidden border border-amber-500/30 bg-slate-900 shadow-xs">
              <Image src="/logo.png" alt="Guild Club Services System Emblem" width={24} height={24} className="h-full w-full object-cover" />
            </div>
          </div>

          <div className="p-4 space-y-3 divide-y divide-stone-100">
            <div className="flex items-center justify-between text-[14px] text-stone-700">
              <span className="font-medium text-stone-500">App Version</span>
              <span className="font-mono font-semibold text-stone-900">v1.2.0 (Native Mobile)</span>
            </div>

            <div className="pt-3 flex items-center justify-between text-[14px] text-stone-700">
              <div className="flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-stone-400" />
                <span className="font-medium text-stone-500">Support Contact</span>
              </div>
              <a
                href="mailto:support@guildclub.com"
                className="font-medium text-[#0B7A63] hover:underline"
              >
                support@guildclub.com
              </a>
            </div>

            <div className="pt-4">
              <LogoutButton
                role={currentUser.role}
                testId="profile-logout-button"
                className="w-full min-h-[48px] h-[48px] border border-rose-300 text-rose-700 hover:bg-rose-50 text-base font-semibold uppercase tracking-wider rounded-none flex items-center justify-center gap-2 select-none touch-manipulation cursor-pointer"
                label="Sign Out"
              />
            </div>
          </div>
        </div>

        {/* Login History Section */}
        <div className="bg-white border border-stone-200 rounded-none shadow-xs overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-800" />
              <h3 className="text-[14px] font-bold uppercase tracking-wide text-stone-900">
                Recent Login History
              </h3>
            </div>
            <span className="text-[12px] text-stone-500">
              {loginRecords.length} sessions
            </span>
          </div>

          {loginRecords.length === 0 ? (
            <div className="p-6 text-center text-[13px] text-stone-500">
              No login history recorded yet.
            </div>
          ) : (
            <table className="w-full block" data-testid="login-history-table">
              <thead className="sr-only">
                <tr>
                  <th>Login Time</th>
                  <th>Status</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody className="block divide-y divide-stone-100">
                {loginRecords.slice(0, 5).map((record) => (
                  <tr
                    key={record.id}
                    data-testid="therapist-login-history-row"
                    className="block p-3.5 space-y-1.5 hover:bg-stone-50 transition-colors"
                  >
                    <td className="flex items-center justify-between text-[14px]">
                      <span className="font-semibold text-stone-900">
                        {record.formattedLoggedInAt}
                      </span>
                      {record.locationStatus === "captured" ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-none">
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-stone-600 border border-stone-300 rounded-none">
                          {record.locationStatus || "Standard"}
                        </span>
                      )}
                    </td>

                    <td className="flex items-center justify-between text-[13px] text-stone-500">
                      <span>Duration: {record.duration || "Active"}</span>
                      {record.mapUrl && (
                        <a
                          href={record.mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#0B7A63] hover:underline font-semibold"
                        >
                          <span>Map</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
