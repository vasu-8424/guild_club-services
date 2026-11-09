"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { type Branch } from "@/db/schema";
import {
  createBranchAction,
  renameBranchAction,
  toggleBranchStatusAction,
  switchBranchAction,
} from "@/lib/actions/branch-actions";
import { Plus, Edit2, Check, X, Building2, ExternalLink } from "lucide-react";

interface BranchesClientProps {
  initialBranches: Branch[];
}

export function BranchesClient({ initialBranches }: BranchesClientProps) {
  const router = useRouter();
  const [branchesList, setBranchesList] = useState<Branch[]>(initialBranches);
  const [isAdding, setIsAdding] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOpenBranch = async (branchId: string) => {
    setLoading(true);
    try {
      await switchBranchAction(branchId);
      router.push(`/super-admin/dashboard?branch=${branchId}`);
      router.refresh();
    } catch {
      router.push(`/super-admin/dashboard?branch=${branchId}`);
      router.refresh();
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;

    setLoading(true);
    setError(null);
    const res = await createBranchAction(newBranchName);
    setLoading(false);

    if (res.success && res.branch) {
      setBranchesList((prev) => [...prev, res.branch!].sort((a, b) => a.name.localeCompare(b.name)));
      setNewBranchName("");
      setIsAdding(false);
    } else {
      setError(res.error || "Failed to create branch.");
    }
  };

  const handleStartRename = (branch: Branch) => {
    setEditingId(branch.id);
    setEditName(branch.name);
    setError(null);
  };

  const handleSaveRename = async (id: string) => {
    if (!editName.trim()) return;

    setLoading(true);
    setError(null);
    const res = await renameBranchAction(id, editName);
    setLoading(false);

    if (res.success) {
      setBranchesList((prev) =>
        prev.map((b) => (b.id === id ? { ...b, name: editName.trim() } : b))
      );
      setEditingId(null);
    } else {
      setError(res.error || "Failed to rename branch.");
    }
  };

  const handleToggleStatus = async (branch: Branch) => {
    const nextStatus = !branch.isActive;
    const confirmMsg = nextStatus
      ? `Activate branch "${branch.name}"?`
      : `Deactivate branch "${branch.name}"?`;

    if (!confirm(confirmMsg)) return;

    setLoading(true);
    setError(null);
    const res = await toggleBranchStatusAction(branch.id, nextStatus);
    setLoading(false);

    if (res.success) {
      setBranchesList((prev) =>
        prev.map((b) => (b.id === branch.id ? { ...b, isActive: nextStatus } : b))
      );
    } else {
      setError(res.error || "Failed to change branch status.");
    }
  };

  return (
    <div className="space-y-4 max-w-xl mx-auto pb-12 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-stone-900 leading-tight">
            Branches
          </h1>
          <p className="text-[13px] text-stone-500 mt-0.5">
            Clinical facilities and therapy practice locations
          </p>
        </div>

        {!isAdding && (
          <button
            type="button"
            data-testid="add-branch-btn"
            onClick={() => setIsAdding(true)}
            className="w-full sm:w-auto min-h-[48px] h-[48px] inline-flex items-center justify-center gap-2 bg-[#0B7A63] hover:bg-[#096350] active:bg-[#064e3e] text-white px-5 text-base font-semibold uppercase tracking-wider rounded-none transition-colors select-none touch-manipulation shadow-xs cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>Create Branch</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-[13px] font-medium">
          {error}
        </div>
      )}

      {/* Add Branch Inline Panel */}
      {isAdding && (
        <div className="bg-white border border-stone-300 p-4 rounded-none shadow-xs">
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label className="block text-[14px] font-semibold text-stone-700 uppercase tracking-wide mb-1">
                Branch Name
              </label>
              <input
                type="text"
                data-testid="branch-name-input"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="Enter branch name (e.g. Wellknox Banjara Hills)"
                className="w-full min-h-[48px] border border-stone-300 px-3.5 py-3 text-base focus:outline-none focus:border-[#0B7A63] rounded-none bg-white"
                autoFocus
                required
              />
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="submit"
                disabled={loading || !newBranchName.trim()}
                data-testid="save-new-branch-btn"
                className="flex-1 min-h-[48px] h-[48px] inline-flex items-center justify-center gap-2 bg-[#0B7A63] hover:bg-[#096350] active:bg-[#064e3e] text-white px-4 text-base font-semibold uppercase tracking-wider rounded-none disabled:opacity-50 cursor-pointer select-none touch-manipulation"
              >
                <Check className="w-5 h-5" />
                <span>Save</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setNewBranchName("");
                }}
                className="min-h-[48px] h-[48px] px-5 border border-stone-300 text-stone-700 hover:bg-stone-100 text-[14px] font-semibold uppercase tracking-wider rounded-none cursor-pointer select-none touch-manipulation"
              >
                <X className="w-4 h-4 mr-1 inline" />
                <span>Cancel</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Branches Stacked Cards */}
      <div className="w-full">
        <table className="w-full block" data-testid="branches-table">
          <thead className="sr-only">
            <tr>
              <th>Branch Name</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="block space-y-3">
            {branchesList.length === 0 ? (
              <tr className="block p-8 text-center text-stone-500 bg-white border border-stone-200">
                <td className="block">No branches found.</td>
              </tr>
            ) : (
              branchesList.map((branch) => (
                <tr
                  key={branch.id}
                  data-testid="branch-row"
                  className="block rounded-none border border-stone-200 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)] hover:border-[#0B7A63] transition-colors space-y-3"
                >
                  <td className="block">
                    {editingId === branch.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="border border-stone-300 px-3.5 py-2.5 text-base focus:outline-none focus:border-[#0B7A63] rounded-none w-full"
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveRename(branch.id)}
                            data-testid={`save-rename-branch-${branch.id}`}
                            className="min-h-[44px] h-[44px] px-4 bg-emerald-700 text-white text-[13px] font-semibold uppercase tracking-wider rounded-none inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                            <span>Save</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="min-h-[44px] h-[44px] px-4 border border-stone-300 text-stone-700 text-[13px] font-semibold uppercase tracking-wider rounded-none inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                            <span>Cancel</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 font-semibold text-[17px] text-stone-900 min-w-0 flex-1">
                          <Building2 className="w-5 h-5 text-[#0B7A63] shrink-0" />
                          <span data-testid={`branch-name-${branch.id}`} className="truncate">
                            {branch.name}
                          </span>
                        </div>
                        {branch.isActive ? (
                          <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wider rounded-none shrink-0">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-bold bg-stone-100 text-stone-600 border border-stone-300 uppercase tracking-wider rounded-none shrink-0">
                            Inactive
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Card Actions: Full-Width Open Branch Button + Secondary Controls */}
                  <td className="block pt-2 border-t border-stone-100 space-y-2">
                    {/* Full-width "Open branch" button */}
                    <button
                      type="button"
                      data-testid={`open-branch-btn-${branch.id}`}
                      onClick={() => handleOpenBranch(branch.id)}
                      disabled={!branch.isActive}
                      className="w-full min-h-[48px] h-[48px] inline-flex items-center justify-center gap-2 bg-[#0B7A63] hover:bg-[#096350] active:bg-[#064e3e] text-white px-4 text-base font-semibold uppercase tracking-wider rounded-none transition-colors select-none touch-manipulation shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>{branch.isActive ? "Open Branch" : "Branch Inactive"}</span>
                    </button>

                    <div className="flex items-center justify-end gap-2.5 pt-1">
                      {editingId !== branch.id && (
                        <button
                          type="button"
                          data-testid={`rename-branch-btn-${branch.id}`}
                          onClick={() => handleStartRename(branch)}
                          className="min-h-[44px] h-[44px] px-3.5 text-[13px] font-semibold text-stone-700 border border-stone-300 hover:bg-stone-100 rounded-none inline-flex items-center gap-1.5 select-none touch-manipulation cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Rename</span>
                        </button>
                      )}
                      <button
                        type="button"
                        data-testid={`toggle-branch-status-btn-${branch.id}`}
                        onClick={() => handleToggleStatus(branch)}
                        className={`min-h-[44px] h-[44px] px-4 text-[13px] font-semibold border rounded-none select-none touch-manipulation cursor-pointer ${
                          branch.isActive
                            ? "text-rose-700 border-rose-300 hover:bg-rose-50"
                            : "text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                        }`}
                      >
                        {branch.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
