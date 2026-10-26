"use client";

import React, { useState } from "react";
import { type Branch } from "@/db/schema";
import {
  createBranchAction,
  renameBranchAction,
  toggleBranchStatusAction,
} from "@/lib/actions/branch-actions";
import { Plus, Edit2, Check, X, Building2 } from "lucide-react";

interface BranchesClientProps {
  initialBranches: Branch[];
}

export function BranchesClient({ initialBranches }: BranchesClientProps) {
  const [branchesList, setBranchesList] = useState<Branch[]>(initialBranches);
  const [isAdding, setIsAdding] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-tight text-stone-900">
            Branches
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Clinical facilities and therapy practice locations
          </p>
        </div>

        {!isAdding && (
          <button
            type="button"
            data-testid="add-branch-btn"
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-2 bg-[#0B7A63] hover:bg-[#096350] text-white px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-none transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Branch</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs">
          {error}
        </div>
      )}

      {/* Add Branch Inline Panel */}
      {isAdding && (
        <div className="bg-stone-50 border border-stone-200 p-4 rounded-none">
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row items-center gap-3">
            <input
              type="text"
              data-testid="branch-name-input"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              placeholder="Enter branch name (e.g. North Center)"
              className="flex-1 w-full border border-stone-300 px-3 py-2 text-xs focus:outline-none focus:border-[#0B7A63] rounded-none bg-white"
              autoFocus
              required
            />
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="submit"
                disabled={loading || !newBranchName.trim()}
                data-testid="save-new-branch-btn"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 bg-[#0B7A63] hover:bg-[#096350] text-white px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-none disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setNewBranchName("");
                }}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 border border-stone-300 text-stone-700 hover:bg-stone-100 px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-none"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Branches Table */}
      <div className="bg-white border border-stone-200 rounded-none shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse" data-testid="branches-table">
          <thead>
            <tr className="bg-stone-100 border-b border-stone-200 text-stone-700 uppercase font-semibold">
              <th className="py-3 px-4">Branch Name</th>
              <th className="py-3 px-4 w-32">Status</th>
              <th className="py-3 px-4 w-44 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {branchesList.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-8 text-center text-stone-500">
                  No branches found.
                </td>
              </tr>
            ) : (
              branchesList.map((branch) => (
                <tr
                  key={branch.id}
                  data-testid="branch-row"
                  className="hover:bg-stone-50 transition-colors"
                >
                  <td className="py-3 px-4">
                    {editingId === branch.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="border border-stone-300 px-2 py-1 text-xs focus:outline-none focus:border-[#0B7A63] rounded-none w-full max-w-sm"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRename(branch.id)}
                          data-testid={`save-rename-branch-${branch.id}`}
                          className="p-1 text-emerald-700 hover:text-emerald-900"
                          title="Save rename"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="p-1 text-stone-500 hover:text-stone-700"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 font-medium text-stone-900">
                        <Building2 className="w-4 h-4 text-stone-400" />
                        <span data-testid={`branch-name-${branch.id}`}>{branch.name}</span>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {branch.isActive ? (
                      <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold bg-stone-100 text-stone-600 border border-stone-300">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {editingId !== branch.id && (
                        <button
                          type="button"
                          data-testid={`rename-branch-btn-${branch.id}`}
                          onClick={() => handleStartRename(branch)}
                          className="px-2.5 py-1 text-xs font-semibold text-stone-700 border border-stone-300 hover:bg-stone-100 rounded-none inline-flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Rename</span>
                        </button>
                      )}
                      <button
                        type="button"
                        data-testid={`toggle-branch-status-btn-${branch.id}`}
                        onClick={() => handleToggleStatus(branch)}
                        className={`px-2.5 py-1 text-xs font-semibold border rounded-none ${
                          branch.isActive
                            ? "text-red-700 border-red-200 hover:bg-red-50"
                            : "text-emerald-700 border-emerald-200 hover:bg-emerald-50"
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
