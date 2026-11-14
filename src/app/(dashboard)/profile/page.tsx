import React from "react";
import Image from "next/image";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users, therapistProfiles, branches, userBranches } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getTherapistLoginHistoryAction } from "@/lib/actions/location-actions";
import { getScope } from "@/lib/scope";
import { APP_VERSION, getBuildId } from "@/lib/app-version";
import {
  User,
  Settings,
  HelpCircle,
  Clock,
  ExternalLink,
  Building2,
  ShieldCheck,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { LogoutButton } from "@/components/layout/logout-button";
import { IosInstallStatusRow } from "@/components/pwa/ios-install-status-row";

export const metadata = {
  title: "Profile & Settings | Guild Club Services",
};

export default async function ProfilePage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }

  // Fetch scope for current user to show active & assigned branches
  let activeBranchName = "No Branch Selected";
  let allowedBranchNames: string[] = [];

  try {
    const scope = await getScope(currentUser);
    allowedBranchNames = scope.allowedBranches.map((b) => b.name);
    activeBranchName = scope.activeBranch?.name || (allowedBranchNames.length > 0 ? allowedBranchNames[0] : "All Facilities");
  } catch {
    // fallback
  }

  // Therapist specific details if therapist
  let therapistExtra: {
    specialization: string | null;
    experienceYears: number | null;
    phone: string | null;
  } | null = null;

  let loginRecords: any[] = [];

  if (currentUser.role === "therapist") {
    const [tp] = await db
      .select({
        phone: users.phone,
        specialization: therapistProfiles.specialization,
        experienceYears: therapistProfiles.experienceYears,
      })
      .from(users)
      .leftJoin(therapistProfiles, eq(therapistProfiles.userId, users.id))
      .where(eq(users.id, currentUser.id))
      .limit(1);

    if (tp) {
      therapistExtra = tp;
    }

    const historyResult = await getTherapistLoginHistoryAction(currentUser.id);
    if (historyResult.success && historyResult.records) {
      loginRecords = historyResult.records;
    }
  }

  const roleLabel = {
    super_admin: "Super Administrator",
    admin: "Clinic Administrator",
    therapist: "Therapist",
  }[currentUser.role];

  const buildId = getBuildId();

  return (
    <DashboardShell user={currentUser} title="Profile & Settings">
      <div className="space-y-4 max-w-xl mx-auto pb-8 w-full">
        {/* Header */}
        <div className="border-b border-stone-200 pb-2">
          <h1
            data-testid="profile-page-title"
            className="text-[22px] font-semibold tracking-tight text-stone-900 leading-tight"
          >
            {currentUser.role === "therapist" ? "Therapist Profile" : "Account & App Settings"}
          </h1>
          <p className="text-[13px] text-stone-500 mt-0.5">
            Personal identity, clinical branch assignments, and system preferences
          </p>
        </div>

        {/* User Summary Card */}
        <div
          data-testid="profile-user-card"
          className="bg-white border border-stone-200 p-4 rounded-none shadow-xs space-y-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 shrink-0 bg-[#0B7A63] text-white flex items-center justify-center font-bold text-lg rounded-none shadow-xs">
              {currentUser.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <h2
                data-testid="profile-user-name"
                className="text-[17px] font-semibold text-stone-900 tracking-tight truncate"
              >
                {currentUser.name}
              </h2>
              <p
                data-testid="profile-user-email"
                className="text-[13px] text-stone-500 truncate"
              >
                {currentUser.email}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-100 text-[13px]">
            <span
              data-testid="profile-role-badge"
              className="inline-flex items-center px-2 py-0.5 font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] rounded-none"
            >
              {roleLabel}
            </span>

            {/* Branch display */}
            <span
              data-testid="profile-branch-badge"
              className="inline-flex items-center gap-1 px-2 py-0.5 font-medium bg-stone-100 text-stone-700 border border-stone-200 text-[12px] rounded-none max-w-full truncate"
            >
              <Building2 className="w-3.5 h-3.5 text-[#0B7A63] shrink-0" />
              <span className="truncate">{activeBranchName}</span>
            </span>

            {/* Therapist specific credentials */}
            {therapistExtra?.specialization && (
              <span className="inline-flex items-center px-2 py-0.5 font-medium bg-stone-100 text-stone-700 border border-stone-200 text-[12px] rounded-none">
                {therapistExtra.specialization}
              </span>
            )}
            {therapistExtra?.experienceYears !== undefined && therapistExtra?.experienceYears !== null && (
              <span className="text-stone-600 text-[13px]">
                • {therapistExtra.experienceYears} Years Exp
              </span>
            )}
            {therapistExtra?.phone && (
              <span className="text-stone-600 text-[13px]">
                • {therapistExtra.phone}
              </span>
            )}
          </div>
        </div>

        {/* App Settings Card */}
        <div
          data-testid="profile-settings-card"
          className="bg-white border border-stone-200 rounded-none shadow-xs overflow-hidden"
        >
          <div className="px-4 py-2.5 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#0B7A63]" />
              <h3 className="text-[13px] font-bold uppercase tracking-wide text-stone-900">
                App Settings &amp; System
              </h3>
            </div>
            <div className="w-6 h-6 rounded-full overflow-hidden border border-amber-500/30 bg-slate-900 shadow-xs">
              <Image
                src="/logo.png"
                alt="Guild Club Services Logo"
                width={24}
                height={24}
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          <div className="p-4 space-y-2.5 divide-y divide-stone-100">
            <div className="flex items-center justify-between text-[13px] text-stone-700">
              <span className="font-medium text-stone-500">App Version</span>
              <span
                className="font-mono font-semibold text-stone-900"
                data-testid="settings-app-version"
              >
                {APP_VERSION} ({buildId})
              </span>
            </div>

            <div className="pt-2 flex items-center justify-between text-[13px] text-stone-700">
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

            <IosInstallStatusRow />

            {/* FULL-WIDTH SIGN OUT BUTTON (Destructive outline style, 52px high) */}
            <div className="pt-3">
              <LogoutButton
                role={currentUser.role}
                variant="destructive-outline"
                testId="profile-logout-button"
                label="Sign Out"
              />
            </div>
          </div>
        </div>

        {/* Therapist Login History Section (If therapist) */}
        {currentUser.role === "therapist" && (
          <div className="bg-white border border-stone-200 rounded-none shadow-xs overflow-hidden">
            <div className="px-4 py-2.5 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-800" />
                <h3 className="text-[13px] font-bold uppercase tracking-wide text-stone-900">
                  Recent Login History
                </h3>
              </div>
              <span className="text-[12px] text-stone-500">
                {loginRecords.length} sessions
              </span>
            </div>

            {loginRecords.length === 0 ? (
              <div className="p-4 text-center text-[13px] text-stone-500">
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
                      className="block p-3 space-y-1 hover:bg-stone-50 transition-colors"
                    >
                      <td className="flex items-center justify-between text-[13px]">
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

                      <td className="flex items-center justify-between text-[12px] text-stone-500">
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
        )}
      </div>
    </DashboardShell>
  );
}

