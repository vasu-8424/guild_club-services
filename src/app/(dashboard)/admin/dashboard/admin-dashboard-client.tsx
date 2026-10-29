"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icons } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { RowActionsMenu, RowActionMenuItem } from "@/components/ui/row-actions-menu";
import { DateSelector } from "@/components/dashboard/date-selector";
import { HistoryBanner } from "@/components/dashboard/history-banner";
import { SendNoteDialog } from "@/components/admin/send-note-dialog";
import { BranchReportButton } from "@/components/admin/branch-report-button";
import { ResetPasswordModal } from "@/components/auth/reset-password-modal";
import { DeleteUserModal } from "@/components/auth/delete-user-modal";
import { LoginActivityModal } from "@/components/therapists/login-activity-modal";
import {
  resetTherapistPasswordAction,
  deleteTherapistAction,
  toggleTherapistStatusAction,
  getTherapistOpenCasesAction,
} from "@/lib/actions/therapist-actions";
import type {
  AdminDashboardData,
  AdminTherapistRow,
} from "@/lib/dashboard-admin";

interface AdminDashboardClientProps {
  data: AdminDashboardData;
}

type SortField =
  | "name"
  | "sessionsOnDate"
  | "activeCases"
  | "closedOnDate"
  | "roomsInUse"
  | "lastLogin";

export function AdminDashboardClient({ data }: AdminDashboardClientProps) {
  const router = useRouter();
  const { stats, therapists: initialTherapists, nullRoomCasesCount, filter } = data;

  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortField, setSortField] = React.useState<SortField>("sessionsOnDate");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("desc");

  // Note dialog
  const [activeNoteTherapist, setActiveNoteTherapist] = React.useState<{
    id: string;
    name: string;
  } | null>(null);

  // Reset password modal
  const [resetModalUser, setResetModalUser] = React.useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);

  // Login & Location Activity modal
  const [activeLoginTherapist, setActiveLoginTherapist] = React.useState<{
    id: string;
    name: string;
  } | null>(null);

  // Delete modal
  const [deleteModalUser, setDeleteModalUser] = React.useState<{
    id: string;
    name: string;
    email: string;
    openCases: Array<{ id: string; caseNumber: string; status: string }>;
  } | null>(null);

  const [isTogglingId, setIsTogglingId] = React.useState<string | null>(null);

  // Sorting handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      // default numbers to desc, name to asc
      setSortDirection(field === "name" ? "asc" : "desc");
    }
  };

  // Filtered & Sorted therapists
  const processedTherapists = React.useMemo(() => {
    let list = [...initialTherapists];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.email.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "sessionsOnDate":
          comparison = a.sessionsOnDate - b.sessionsOnDate;
          break;
        case "activeCases":
          comparison = a.activeCases - b.activeCases;
          break;
        case "closedOnDate":
          comparison = a.closedOnDate - b.closedOnDate;
          break;
        case "roomsInUse":
          comparison = a.roomsInUse - b.roomsInUse;
          break;
        case "lastLogin": {
          const timeA = a.rawLastLoginDate ? a.rawLastLoginDate.getTime() : 0;
          const timeB = b.rawLastLoginDate ? b.rawLastLoginDate.getTime() : 0;
          comparison = timeA - timeB;
          break;
        }
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return list;
  }, [initialTherapists, searchQuery, sortField, sortDirection]);

  // Totals calculation
  const totals = React.useMemo(() => {
    return processedTherapists.reduce(
      (acc, t) => {
        acc.sessions += t.sessionsOnDate;
        acc.activeCases += t.activeCases;
        acc.closedCases += t.closedOnDate;
        acc.roomsInUse += t.roomsInUse;
        return acc;
      },
      { sessions: 0, activeCases: 0, closedCases: 0, roomsInUse: 0 }
    );
  }, [processedTherapists]);

  // Handle Deactivate / Activate
  const handleToggleStatus = async (therapist: AdminTherapistRow) => {
    setIsTogglingId(therapist.id);
    try {
      const res = await toggleTherapistStatusAction({
        userId: therapist.id,
        isActive: !therapist.isActive,
      });
      if (!res.success && res.error) {
        alert(res.error);
      } else {
        router.refresh();
      }
    } catch {
      alert("Failed to toggle practitioner status.");
    } finally {
      setIsTogglingId(null);
    }
  };

  // Handle Open Delete Modal
  const handleOpenDelete = async (therapist: AdminTherapistRow) => {
    try {
      const openCases = await getTherapistOpenCasesAction(therapist.id);
      setDeleteModalUser({
        id: therapist.id,
        name: therapist.name,
        email: therapist.email,
        openCases: Array.isArray(openCases) ? openCases : [],
      });
    } catch {
      setDeleteModalUser({
        id: therapist.id,
        name: therapist.name,
        email: therapist.email,
        openCases: [],
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar: Title & Date Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider text-slate-900">
            Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational clinical overview for{" "}
            <strong className="text-slate-800 font-semibold">{filter.filterLabel}</strong>{" "}
            (Asia/Kolkata).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <BranchReportButton />
          <div data-testid="dashboard-date-selector">
            <DateSelector />
          </div>
        </div>
      </div>

      {/* Historical past date read-only banner */}
      <HistoryBanner filter={filter} hasActivity={true} />

      {/* Null Room Cases Banner */}
      {nullRoomCasesCount > 0 && (
        <div
          data-testid="null-room-cases-banner"
          className="flex items-center justify-between gap-4 p-4 bg-amber-50 border border-amber-300 rounded-none text-xs text-amber-900 shadow-xs"
        >
          <div className="flex items-center gap-2.5">
            <Icons.Alert className="h-5 w-5 text-amber-700 shrink-0" />
            <div>
              <p className="font-bold text-amber-950">
                {nullRoomCasesCount} open {nullRoomCasesCount === 1 ? "case has" : "cases have"} no room. Please edit them.
              </p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Assign a free treatment room to maintain live room occupancy integrity.
              </p>
            </div>
          </div>
          <Link
            href="/admin/cases"
            className="px-3 py-1.5 bg-amber-800 text-white font-bold text-[11px] uppercase tracking-wider hover:bg-amber-900 transition-colors whitespace-nowrap rounded-none"
          >
            Review Cases &rarr;
          </Link>
        </div>
      )}

      {/* Four Plain Number Boxes (NO charts, NO sparklines) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Therapists (active) */}
        <div
          data-testid="stat-therapists"
          className="border border-slate-200 bg-white p-5 shadow-xs rounded-none"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Therapists (active)
          </p>
          <p className="text-3xl font-bold font-mono text-slate-900 mt-2">
            {stats.activeTherapists}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Practitioners on duty</p>
        </div>

        {/* 2. Active cases */}
        <div
          data-testid="stat-active-cases"
          className="border border-slate-200 bg-white p-5 shadow-xs rounded-none"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Active cases
          </p>
          <p className="text-3xl font-bold font-mono text-slate-900 mt-2">
            {stats.activeCases}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {filter.isPast ? "Active on this date" : "Current open treatments"}
          </p>
        </div>

        {/* 3. Sessions on selected date */}
        <div
          data-testid="stat-sessions"
          className="border border-slate-200 bg-white p-5 shadow-xs rounded-none"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Sessions on date
          </p>
          <p className="text-3xl font-bold font-mono text-[#0B7A63] mt-2">
            {stats.sessionsOnDate}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Recorded for {filter.filterLabel}</p>
        </div>

        {/* 4. Rooms (free / total) */}
        <div
          data-testid="stat-rooms"
          className="border border-slate-200 bg-white p-5 shadow-xs rounded-none"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Rooms (free / total)
          </p>
          <p className="text-3xl font-bold font-mono text-slate-900 mt-2">
            {stats.roomsFree} / {stats.roomsTotal}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Available across branches</p>
        </div>
      </div>

      {/* Main Section: Therapists Table */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Therapists
            </h2>
            <p className="text-xs text-slate-500">
              Practitioner activity, sessions logged, active cases, and occupied rooms.
            </p>
          </div>

          {/* Search Box */}
          <div className="w-full sm:w-72">
            <input
              type="text"
              data-testid="therapist-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search therapist by name..."
              className="w-full border border-slate-300 px-3 py-1.5 text-xs text-slate-900 rounded-none bg-white focus:outline-none focus:border-[#0B7A63]"
            />
          </div>
        </div>

        {/* Table Container */}
        <div className="border border-slate-200 bg-white shadow-xs rounded-none overflow-x-auto">
          {processedTherapists.length === 0 && initialTherapists.length === 0 ? (
            /* Empty State */
            <div
              data-testid="therapists-empty-state"
              className="py-12 px-4 text-center space-y-3"
            >
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-none bg-slate-100 text-slate-500">
                <Icons.Therapists className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                No therapists yet. Create your first therapist.
              </p>
              <Link href="/admin/therapists/new">
                <Button variant="primary" size="sm" leadingIcon={<Icons.Plus />}>
                  + Create Therapist
                </Button>
              </Link>
            </div>
          ) : processedTherapists.length === 0 ? (
            <div className="py-8 px-4 text-center text-xs text-slate-500">
              No therapists match your search criteria.
            </div>
          ) : (
            <table
              data-testid="therapists-table"
              className="w-full text-left text-xs border-collapse"
            >
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 uppercase font-semibold select-none">
                  <th
                    onClick={() => handleSort("name")}
                    className="py-3 px-4 cursor-pointer hover:bg-slate-200/70 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Therapist</span>
                      {sortField === "name" && (
                        <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("sessionsOnDate")}
                    className="py-3 px-4 cursor-pointer hover:bg-slate-200/70 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Sessions on this date</span>
                      {sortField === "sessionsOnDate" && (
                        <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("activeCases")}
                    className="py-3 px-4 cursor-pointer hover:bg-slate-200/70 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Active cases</span>
                      {sortField === "activeCases" && (
                        <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("closedOnDate")}
                    className="py-3 px-4 cursor-pointer hover:bg-slate-200/70 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Cases closed on this date</span>
                      {sortField === "closedOnDate" && (
                        <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("roomsInUse")}
                    className="py-3 px-4 cursor-pointer hover:bg-slate-200/70 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Rooms in use</span>
                      {sortField === "roomsInUse" && (
                        <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("lastLogin")}
                    className="py-3 px-4 cursor-pointer hover:bg-slate-200/70 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Last login</span>
                      {sortField === "lastLogin" && (
                        <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                      )}
                    </div>
                  </th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-sans text-slate-800">
                {processedTherapists.map((therapist) => {
                  const menuItems: RowActionMenuItem[] = [
                    {
                      key: "view-details",
                      label: "View details",
                      icon: <Icons.User />,
                      onClick: () => router.push(`/admin/therapists/${therapist.id}`),
                      "data-testid": `view-therapist-details-${therapist.id}`,
                    },
                    {
                      key: "edit",
                      label: "Edit",
                      icon: <Icons.Edit />,
                      onClick: () => router.push(`/admin/therapists/${therapist.id}/edit`),
                      "data-testid": `edit-therapist-${therapist.id}`,
                    },
                    {
                      key: "reset-password",
                      label: "Reset password",
                      icon: <Icons.ArrowCounterClockwise />,
                      onClick: () =>
                        setResetModalUser({
                          id: therapist.id,
                          name: therapist.name,
                          email: therapist.email,
                        }),
                      variant: "warning",
                      "data-testid": `reset-therapist-pwd-${therapist.id}`,
                    },
                    {
                      key: "login-activity",
                      label: "Daily activity & location",
                      icon: <Icons.Clock />,
                      onClick: () =>
                        setActiveLoginTherapist({
                          id: therapist.id,
                          name: therapist.name,
                        }),
                      "data-testid": `login-activity-btn-${therapist.id}`,
                    },
                    {
                      key: "toggle-status",
                      label: therapist.isActive
                        ? "Deactivate practitioner"
                        : "Activate practitioner",
                      icon: therapist.isActive ? <Icons.X /> : <Icons.Check />,
                      onClick: () => handleToggleStatus(therapist),
                      disabled: isTogglingId === therapist.id,
                      "data-testid": `toggle-therapist-btn-${therapist.id}`,
                    },
                    {
                      key: "delete",
                      label: "Delete practitioner",
                      icon: <Icons.Trash />,
                      onClick: () => handleOpenDelete(therapist),
                      variant: "destructive",
                      isDividerBefore: true,
                      "data-testid": `delete-therapist-btn-${therapist.id}`,
                    },
                  ];

                  return (
                    <tr
                      key={therapist.id}
                      data-testid={`therapist-row-${therapist.id}`}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      {/* Therapist Column */}
                      <td className="py-3 px-4">
                        <Link
                          href={`/admin/therapists/${therapist.id}`}
                          className="font-bold text-slate-900 hover:text-[#0B7A63] transition-colors block"
                        >
                          {therapist.name}
                        </Link>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {therapist.email}
                        </span>
                      </td>

                      {/* Sessions on date */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {therapist.sessionsOnDate}
                      </td>

                      {/* Active cases */}
                      <td className="py-3 px-4 font-mono text-slate-800">
                        {therapist.activeCases}
                      </td>

                      {/* Closed on date */}
                      <td className="py-3 px-4 font-mono text-slate-800">
                        {therapist.closedOnDate}
                      </td>

                      {/* Rooms in use */}
                      <td className="py-3 px-4 font-mono text-slate-800">
                        {therapist.roomsInUse}
                      </td>

                      {/* Last login */}
                      <td className="py-3 px-4 text-[11px] font-mono text-slate-600">
                        {therapist.lastLogin}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            leadingIcon={<Icons.Envelope />}
                            onClick={() =>
                              setActiveNoteTherapist({
                                id: therapist.id,
                                name: therapist.name,
                              })
                            }
                            data-testid={`send-note-btn-${therapist.id}`}
                            title="Send note"
                          >
                            Send note
                          </Button>
                          <RowActionsMenu
                            items={menuItems}
                            triggerTestId={`row-actions-kebab-${therapist.id}`}
                            menuTestId={`row-actions-menu-${therapist.id}`}
                            buttonTitle="More actions"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Totals Row */}
              <tfoot>
                <tr
                  data-testid="totals-row"
                  className="bg-slate-100/90 border-t-2 border-slate-300 font-bold text-slate-900"
                >
                  <td className="py-3 px-4 uppercase text-xs tracking-wider">
                    Total
                  </td>
                  <td className="py-3 px-4 font-mono">
                    {totals.sessions}
                  </td>
                  <td className="py-3 px-4 font-mono">
                    {totals.activeCases}
                  </td>
                  <td className="py-3 px-4 font-mono">
                    {totals.closedCases}
                  </td>
                  <td className="py-3 px-4 font-mono">
                    {totals.roomsInUse}
                  </td>
                  <td className="py-3 px-4 text-slate-400 font-normal">—</td>
                  <td className="py-3 px-4 text-slate-400 font-normal text-right">—</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* Send Note Dialog */}
      {activeNoteTherapist && (
        <SendNoteDialog
          isOpen={Boolean(activeNoteTherapist)}
          onClose={() => setActiveNoteTherapist(null)}
          therapistId={activeNoteTherapist.id}
          therapistName={activeNoteTherapist.name}
          onSuccess={() => router.refresh()}
        />
      )}

      {/* Reset Password Modal */}
      {resetModalUser && (
        <ResetPasswordModal
          isOpen={Boolean(resetModalUser)}
          onClose={() => setResetModalUser(null)}
          userId={resetModalUser.id}
          userName={resetModalUser.name}
          userEmail={resetModalUser.email}
          roleLabel="therapist"
          onReset={resetTherapistPasswordAction}
        />
      )}

      {/* Delete User Modal */}
      {deleteModalUser && (
        <DeleteUserModal
          isOpen={Boolean(deleteModalUser)}
          onClose={() => setDeleteModalUser(null)}
          userId={deleteModalUser.id}
          userName={deleteModalUser.name}
          userEmail={deleteModalUser.email}
          roleLabel="therapist"
          openCases={deleteModalUser.openCases}
          onDelete={deleteTherapistAction}
        />
      )}

      {/* Login & Location Activity Modal */}
      {activeLoginTherapist && (
        <LoginActivityModal
          isOpen={Boolean(activeLoginTherapist)}
          onClose={() => setActiveLoginTherapist(null)}
          therapistId={activeLoginTherapist.id}
          therapistName={activeLoginTherapist.name}
        />
      )}
    </div>
  );
}
