"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { updateAdminBranchesAction } from "@/lib/actions/admin-actions";
import { Button } from "@/components/ui/button";
import { AlertCircle, X } from "lucide-react";

interface BranchOption {
  id: string;
  name: string;
  isActive: boolean;
}

interface EditAdminBranchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminId: string;
  adminName: string;
  branches: BranchOption[];
  assignedBranchIds: string[];
  onSaved?: (newIds?: string[]) => void;
}

export function EditAdminBranchesModal({
  isOpen,
  onClose,
  adminId,
  adminName,
  branches,
  assignedBranchIds,
  onSaved,
}: EditAdminBranchesModalProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = React.useState<string[]>(assignedBranchIds);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    setSelectedIds(assignedBranchIds);
    setError(null);
  }, [assignedBranchIds, isOpen]);

  if (!isOpen) return null;

  const activeBranches = branches.filter((b) => b.isActive);

  const handleToggle = (branchId: string) => {
    setSelectedIds((prev) => {
      const next = prev.includes(branchId)
        ? prev.filter((id) => id !== branchId)
        : [...prev, branchId];

      if (next.length === 0) {
        setError("An administrator must keep at least one branch");
      } else {
        setError(null);
      }
      return next;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedIds.length === 0) {
      setError("An administrator must keep at least one branch");
      return;
    }

    setIsLoading(true);

    try {
      const res = await updateAdminBranchesAction({
        adminId,
        branchIds: selectedIds,
      });

      if (!res.success) {
        setError(res.error || "Failed to update branches");
        setIsLoading(false);
        return;
      }

      router.refresh();
      if (onSaved) onSaved(selectedIds);
      onClose();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="edit-branches-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-lg bg-white border border-slate-200 shadow-xl rounded-none">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Edit Branch Access
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Assigned branches for {adminName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <p
            data-testid="edit-branches-helper"
            className="text-xs text-slate-600"
          >
            The administrator can see only the selected branches. Required: choose at least one.
          </p>

          {error && (
            <div
              data-testid="edit-branches-error"
              className="flex items-center gap-2 rounded-none border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div
            data-testid="edit-branches-list"
            className="space-y-2 max-h-72 overflow-y-auto pt-1"
          >
            {activeBranches.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">
                No active branches available.
              </p>
            ) : (
              activeBranches.map((branch) => {
                const isChecked = selectedIds.includes(branch.id);
                return (
                  <div
                    key={branch.id}
                    data-testid={`edit-branch-row-${branch.id}`}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).tagName.toLowerCase() !== "input") {
                        handleToggle(branch.id);
                      }
                    }}
                    className={`flex items-center justify-between p-3 border cursor-pointer select-none transition-colors rounded-none ${
                      isChecked
                        ? "border-[#0B7A63] bg-[#0B7A63]/5 text-slate-900"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`edit-branch-${branch.id}`}
                        data-testid={`edit-branch-checkbox-${branch.id}`}
                        checked={isChecked}
                        onChange={() => handleToggle(branch.id)}
                        className="h-4 w-4 rounded-none border-slate-300 text-[#0B7A63] focus:ring-[#0B7A63] cursor-pointer"
                      />
                      <label
                        htmlFor={`edit-branch-${branch.id}`}
                        className="text-sm font-semibold cursor-pointer"
                        onClick={(e) => e.preventDefault()}
                      >
                        {branch.name}
                      </label>
                    </div>
                    {isChecked && (
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0B7A63] bg-[#0B7A63]/10 px-2 py-0.5 rounded-none">
                        Assigned
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              data-testid="cancel-edit-branches-button"
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              data-testid="save-branches-button"
              type="submit"
              variant="primary"
              isLoading={isLoading}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

