"use client";

import * as React from "react";
import { Icons } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import {
  type RoomListItem,
  getRoomsAction,
  createRoomAction,
  bulkCreateRoomsAction,
  updateRoomAction,
  toggleRoomActiveAction,
  deleteRoomAction,
} from "@/lib/actions/room-management-actions";
import type { Branch } from "@/db/schema";

interface RoomsClientProps {
  initialRooms: RoomListItem[];
  branches: Branch[];
}

export function RoomsClient({ initialRooms, branches }: RoomsClientProps) {
  const [roomsList, setRoomsList] = React.useState<RoomListItem[]>(initialRooms);
  const [branchFilter, setBranchFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  // Modals state
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [addMode, setAddMode] = React.useState<"single" | "bulk">("single");

  // Single Add form
  const [singleRoomNo, setSingleRoomNo] = React.useState("");
  const [singleBranchId, setSingleBranchId] = React.useState(branches[0]?.id || "");
  const [singleError, setSingleError] = React.useState<string | null>(null);

  // Bulk Add form
  const [bulkPrefix, setBulkPrefix] = React.useState("R-");
  const [bulkStart, setBulkStart] = React.useState("1");
  const [bulkEnd, setBulkEnd] = React.useState("10");
  const [bulkBranchId, setBulkBranchId] = React.useState(branches[0]?.id || "");
  const [bulkError, setBulkError] = React.useState<string | null>(null);
  const [bulkSummary, setBulkSummary] = React.useState<{
    totalRequested: number;
    createdCount: number;
    skippedCount: number;
    skippedRooms: string[];
  } | null>(null);

  // Edit Room Modal
  const [editingRoom, setEditingRoom] = React.useState<RoomListItem | null>(null);
  const [editRoomNo, setEditRoomNo] = React.useState("");
  const [editError, setEditError] = React.useState<string | null>(null);

  // Delete Confirm Modal
  const [deletingRoom, setDeletingRoom] = React.useState<RoomListItem | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Refresh rooms list
  const refreshRooms = React.useCallback(async () => {
    try {
      const res = await getRoomsAction();
      if (res.success && res.data) {
        setRoomsList(res.data);
      }
    } catch {
      // silent
    }
  }, []);

  // Poll rooms every 20 seconds
  React.useEffect(() => {
    const interval = setInterval(refreshRooms, 20000);
    return () => clearInterval(interval);
  }, [refreshRooms]);

  // Filtered rooms
  const filteredRooms = React.useMemo(() => {
    return roomsList.filter((r) => {
      if (branchFilter !== "all" && r.branchId !== branchFilter) return false;
      if (statusFilter !== "all" && r.status.toLowerCase() !== statusFilter.toLowerCase())
        return false;
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchRoom = r.roomNo.toLowerCase().includes(query);
        const matchBranch = r.branchName.toLowerCase().includes(query);
        const matchPatient = r.currentPatient.toLowerCase().includes(query);
        const matchTherapist = r.therapist.toLowerCase().includes(query);
        if (!matchRoom && !matchBranch && !matchPatient && !matchTherapist) return false;
      }
      return true;
    });
  }, [roomsList, branchFilter, statusFilter, searchQuery]);

  // Handle single create
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSingleError(null);
    if (!singleRoomNo.trim()) {
      setSingleError("Room number is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createRoomAction({
        roomNo: singleRoomNo.trim(),
        branchId: singleBranchId,
      });

      if (!res.success) {
        setSingleError(res.error || "Failed to create room.");
        setIsSubmitting(false);
        return;
      }

      setSingleRoomNo("");
      setShowAddModal(false);
      await refreshRooms();
    } catch {
      setSingleError("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle bulk create
  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkError(null);
    setBulkSummary(null);

    const start = parseInt(bulkStart, 10);
    const end = parseInt(bulkEnd, 10);

    if (isNaN(start) || isNaN(end) || start < 1 || end < 1) {
      setBulkError("Start and End must be positive numbers.");
      return;
    }

    if (start > end) {
      setBulkError("Start number cannot be greater than End number.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await bulkCreateRoomsAction({
        prefix: bulkPrefix,
        startNo: start,
        endNo: end,
        branchId: bulkBranchId,
      });

      if (!res.success) {
        setBulkError(res.error || "Failed to bulk create rooms.");
        setIsSubmitting(false);
        return;
      }

      setBulkSummary({
        totalRequested: res.totalRequested,
        createdCount: res.createdCount,
        skippedCount: res.skippedCount,
        skippedRooms: res.skippedRooms,
      });
      await refreshRooms();
    } catch {
      setBulkError("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit room
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom) return;
    setEditError(null);

    if (!editRoomNo.trim()) {
      setEditError("Room number cannot be empty.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updateRoomAction({
        id: editingRoom.id,
        roomNo: editRoomNo.trim(),
      });

      if (!res.success) {
        setEditError(res.error || "Failed to update room.");
        setIsSubmitting(false);
        return;
      }

      setEditingRoom(null);
      await refreshRooms();
    } catch {
      setEditError("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle toggle active
  const handleToggleActive = async (room: RoomListItem) => {
    if (room.status === "OCCUPIED" && room.isActive) {
      alert("Cannot deactivate an occupied room.");
      return;
    }

    try {
      const res = await toggleRoomActiveAction({
        id: room.id,
        isActive: !room.isActive,
      });

      if (!res.success) {
        alert(res.error || "Failed to toggle status.");
      } else {
        await refreshRooms();
      }
    } catch {
      alert("An unexpected error occurred.");
    }
  };

  // Handle delete room
  const handleDeleteConfirm = async () => {
    if (!deletingRoom) return;
    setDeleteError(null);

    if (deletingRoom.hasEverBeenUsed) {
      setDeleteError(
        "A room cannot be deleted if it has ever been used; deactivate it instead."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await deleteRoomAction({ id: deletingRoom.id });
      if (!res.success) {
        setDeleteError(res.error || "Failed to delete room.");
        setIsSubmitting(false);
        return;
      }

      setDeletingRoom(null);
      await refreshRooms();
    } catch {
      setDeleteError("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider text-slate-900">
            Rooms Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage treatment rooms across branches. Occupancy is computed live from active cases.
          </p>
        </div>
        <Button
          data-testid="add-room-button"
          variant="primary"
          size="sm"
          leadingIcon={<Icons.Plus />}
          onClick={() => {
            setShowAddModal(true);
            setAddMode("single");
            setSingleError(null);
            setBulkError(null);
            setBulkSummary(null);
          }}
        >
          + Add Room
        </Button>
      </div>

      {/* Controls: Search, Branch Filter, Status Filter */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            data-testid="room-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by room, patient, or therapist..."
            className="w-full border border-slate-300 px-3 py-2 text-xs text-slate-900 rounded-none bg-white focus:outline-none focus:border-[#0B7A63]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
            >
              <Icons.Close className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Branch Filter */}
        <div>
          <select
            data-testid="branch-filter-select"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="w-full border border-slate-300 px-3 py-2 text-xs text-slate-700 rounded-none bg-white font-medium focus:outline-none focus:border-[#0B7A63]"
          >
            <option value="all">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            data-testid="status-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full border border-slate-300 px-3 py-2 text-xs text-slate-700 rounded-none bg-white font-medium focus:outline-none focus:border-[#0B7A63]"
          >
            <option value="all">All Statuses</option>
            <option value="free">FREE</option>
            <option value="occupied">OCCUPIED</option>
            <option value="inactive">INACTIVE</option>
          </select>
        </div>
      </div>

      {/* Rooms Table */}
      <div className="border border-slate-200 bg-white shadow-xs rounded-none overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse" data-testid="rooms-table">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 uppercase font-semibold">
              <th className="py-3 px-4">Room</th>
              <th className="py-3 px-4">Branch</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Current Patient</th>
              <th className="py-3 px-4">Therapist</th>
              <th className="py-3 px-4">Since</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-sans text-slate-800">
            {filteredRooms.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 px-4 text-center text-slate-500">
                  No rooms found matching the criteria.
                </td>
              </tr>
            ) : (
              filteredRooms.map((room) => (
                <tr
                  key={room.id}
                  data-testid={`room-row-${room.id}`}
                  className="hover:bg-slate-50/70 transition-colors"
                >
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {room.roomNo}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-700">
                    {room.branchName}
                  </td>
                  <td className="py-3 px-4">
                    {room.status === "FREE" ? (
                      <span
                        data-testid={`room-status-badge-${room.id}`}
                        className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wider rounded-none"
                      >
                        FREE
                      </span>
                    ) : room.status === "OCCUPIED" ? (
                      <span
                        data-testid={`room-status-badge-${room.id}`}
                        className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-800 border border-red-300 uppercase tracking-wider rounded-none"
                      >
                        OCCUPIED
                      </span>
                    ) : (
                      <span
                        data-testid={`room-status-badge-${room.id}`}
                        className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 uppercase tracking-wider rounded-none"
                      >
                        INACTIVE
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {room.currentPatient !== "—" ? (
                      <span className="font-semibold text-slate-900">
                        {room.currentPatient}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {room.therapist !== "—" ? (
                      <span className="text-slate-800 font-medium">{room.therapist}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                    {room.since}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Rename (only when free) */}
                      <button
                        type="button"
                        data-testid={`edit-room-btn-${room.id}`}
                        disabled={room.status === "OCCUPIED"}
                        onClick={() => {
                          setEditingRoom(room);
                          setEditRoomNo(room.roomNo);
                          setEditError(null);
                        }}
                        className={`p-1 text-slate-500 hover:text-slate-800 transition-colors ${
                          room.status === "OCCUPIED"
                            ? "opacity-30 cursor-not-allowed"
                            : ""
                        }`}
                        title={
                          room.status === "OCCUPIED"
                            ? "Cannot rename an occupied room"
                            : "Rename room"
                        }
                      >
                        <Icons.PencilSimple className="h-4 w-4" />
                      </button>

                      {/* Deactivate / Activate (deactivate only when free) */}
                      <button
                        type="button"
                        data-testid={`toggle-room-btn-${room.id}`}
                        disabled={room.status === "OCCUPIED" && room.isActive}
                        onClick={() => handleToggleActive(room)}
                        className={`p-1 text-slate-500 hover:text-slate-800 transition-colors ${
                          room.status === "OCCUPIED" && room.isActive
                            ? "opacity-30 cursor-not-allowed"
                            : ""
                        }`}
                        title={
                          room.status === "OCCUPIED" && room.isActive
                            ? "Cannot deactivate an occupied room"
                            : room.isActive
                            ? "Deactivate room"
                            : "Activate room"
                        }
                      >
                        {room.isActive ? (
                          <Icons.X className="h-4 w-4 text-amber-600" />
                        ) : (
                          <Icons.Check className="h-4 w-4 text-emerald-600" />
                        )}
                      </button>

                      {/* Delete (only if never used) */}
                      <button
                        type="button"
                        data-testid={`delete-room-btn-${room.id}`}
                        onClick={() => {
                          setDeletingRoom(room);
                          setDeleteError(null);
                        }}
                        className="p-1 text-red-500 hover:text-red-700 transition-colors"
                        title="Delete room"
                      >
                        <Icons.Trash className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Room Modal (Single & Bulk) */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md border border-slate-200 bg-white shadow-xl rounded-none">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 bg-slate-50">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                + Add Room
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <Icons.Close className="h-4 w-4" />
              </button>
            </div>

            {/* Mode Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-100">
              <button
                type="button"
                data-testid="tab-single-room"
                onClick={() => setAddMode("single")}
                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider ${
                  addMode === "single"
                    ? "bg-white border-b-2 border-b-[#0B7A63] text-[#0B7A63]"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Single Room
              </button>
              <button
                type="button"
                data-testid="tab-bulk-room"
                onClick={() => setAddMode("bulk")}
                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider ${
                  addMode === "bulk"
                    ? "bg-white border-b-2 border-b-[#0B7A63] text-[#0B7A63]"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Add Many (Bulk)
              </button>
            </div>

            {addMode === "single" ? (
              <form onSubmit={handleSingleSubmit} className="p-5 space-y-4">
                {singleError && (
                  <div
                    data-testid="add-room-error"
                    className="p-3 text-xs bg-red-50 border border-red-200 text-red-800 rounded-none flex items-start gap-2"
                  >
                    <Icons.Alert className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{singleError}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Room Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    data-testid="room-number-input"
                    value={singleRoomNo}
                    onChange={(e) => setSingleRoomNo(e.target.value)}
                    placeholder="e.g. Room 101 or 204-A"
                    required
                    className="w-full border border-slate-300 px-3 py-2 text-xs text-slate-900 rounded-none focus:outline-none focus:border-[#0B7A63]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Branch <span className="text-red-500">*</span>
                  </label>
                  <select
                    data-testid="room-branch-select"
                    value={singleBranchId}
                    onChange={(e) => setSingleBranchId(e.target.value)}
                    className="w-full border border-slate-300 px-3 py-2 text-xs text-slate-800 rounded-none bg-white font-medium focus:outline-none focus:border-[#0B7A63]"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddModal(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isSubmitting || !singleRoomNo.trim()}
                    data-testid="save-room-button"
                  >
                    {isSubmitting ? "Saving..." : "Create Room"}
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleBulkSubmit} className="p-5 space-y-4">
                {bulkError && (
                  <div
                    data-testid="bulk-room-error"
                    className="p-3 text-xs bg-red-50 border border-red-200 text-red-800 rounded-none flex items-start gap-2"
                  >
                    <Icons.Alert className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{bulkError}</span>
                  </div>
                )}

                {bulkSummary && (
                  <div
                    data-testid="bulk-room-summary"
                    className="p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-none space-y-1"
                  >
                    <p className="font-bold flex items-center gap-1.5">
                      <Icons.Check className="h-4 w-4 text-emerald-600" />
                      Bulk Creation Complete
                    </p>
                    <p>
                      Created: <strong>{bulkSummary.createdCount}</strong> rooms.
                    </p>
                    {bulkSummary.skippedCount > 0 && (
                      <p className="text-amber-800">
                        Skipped (already existing):{" "}
                        <strong>{bulkSummary.skippedCount}</strong> (
                        {bulkSummary.skippedRooms.join(", ")})
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Prefix (e.g. &apos;R-&apos; or &apos;Room &apos;)
                  </label>
                  <input
                    type="text"
                    data-testid="bulk-prefix-input"
                    value={bulkPrefix}
                    onChange={(e) => setBulkPrefix(e.target.value)}
                    placeholder="R-"
                    className="w-full border border-slate-300 px-3 py-2 text-xs text-slate-900 rounded-none focus:outline-none focus:border-[#0B7A63]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Start Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      data-testid="bulk-start-input"
                      value={bulkStart}
                      min={1}
                      onChange={(e) => setBulkStart(e.target.value)}
                      required
                      className="w-full border border-slate-300 px-3 py-2 text-xs text-slate-900 rounded-none focus:outline-none focus:border-[#0B7A63]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      End Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      data-testid="bulk-end-input"
                      value={bulkEnd}
                      min={1}
                      onChange={(e) => setBulkEnd(e.target.value)}
                      required
                      className="w-full border border-slate-300 px-3 py-2 text-xs text-slate-900 rounded-none focus:outline-none focus:border-[#0B7A63]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Branch <span className="text-red-500">*</span>
                  </label>
                  <select
                    data-testid="bulk-branch-select"
                    value={bulkBranchId}
                    onChange={(e) => setBulkBranchId(e.target.value)}
                    className="w-full border border-slate-300 px-3 py-2 text-xs text-slate-800 rounded-none bg-white font-medium focus:outline-none focus:border-[#0B7A63]"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddModal(false)}
                    disabled={isSubmitting}
                  >
                    Close
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isSubmitting}
                    data-testid="bulk-submit-button"
                  >
                    {isSubmitting ? "Generating..." : "Generate Rooms"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Edit Room Modal */}
      {editingRoom && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md border border-slate-200 bg-white shadow-xl rounded-none">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 bg-slate-50">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                Rename Room
              </h2>
              <button
                type="button"
                onClick={() => setEditingRoom(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <Icons.Close className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              {editError && (
                <div
                  data-testid="edit-room-error"
                  className="p-3 text-xs bg-red-50 border border-red-200 text-red-800 rounded-none flex items-start gap-2"
                >
                  <Icons.Alert className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Branch
                </label>
                <input
                  type="text"
                  readOnly
                  value={editingRoom.branchName}
                  className="w-full border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 rounded-none select-none cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Room Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  data-testid="edit-room-number-input"
                  value={editRoomNo}
                  onChange={(e) => setEditRoomNo(e.target.value)}
                  required
                  className="w-full border border-slate-300 px-3 py-2 text-xs text-slate-900 rounded-none focus:outline-none focus:border-[#0B7A63]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingRoom(null)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmitting || !editRoomNo.trim()}
                  data-testid="save-edit-room-button"
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deletingRoom && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md border border-slate-200 bg-white shadow-xl rounded-none">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 bg-slate-50">
              <h2 className="text-sm font-bold uppercase tracking-wider text-red-900 flex items-center gap-2">
                <Icons.Trash className="h-4 w-4 text-red-600" />
                Delete Room
              </h2>
              <button
                type="button"
                onClick={() => setDeletingRoom(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <Icons.Close className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {deleteError && (
                <div
                  data-testid="delete-room-error"
                  className="p-3 text-xs bg-red-50 border border-red-200 text-red-800 rounded-none flex items-start gap-2"
                >
                  <Icons.Alert className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{deleteError}</span>
                </div>
              )}

              {deletingRoom.hasEverBeenUsed ? (
                <div className="p-3 text-xs bg-amber-50 border border-amber-300 text-amber-900 rounded-none">
                  <p className="font-bold">Cannot delete used room</p>
                  <p className="mt-1">
                    Room <strong>{deletingRoom.roomNo}</strong> in{" "}
                    <strong>{deletingRoom.branchName}</strong> has been linked to
                    patient cases. Rooms that have ever been used cannot be deleted.
                    Please deactivate it instead.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-600">
                  Are you sure you want to delete Room{" "}
                  <strong className="text-slate-900">{deletingRoom.roomNo}</strong> in{" "}
                  <strong>{deletingRoom.branchName}</strong>? This action cannot be undone.
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDeletingRoom(null)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                {!deletingRoom.hasEverBeenUsed ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteConfirm}
                    disabled={isSubmitting}
                    data-testid="confirm-delete-room-button"
                  >
                    {isSubmitting ? "Deleting..." : "Confirm Delete"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setDeletingRoom(null);
                      handleToggleActive(deletingRoom);
                    }}
                  >
                    Deactivate Instead
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
