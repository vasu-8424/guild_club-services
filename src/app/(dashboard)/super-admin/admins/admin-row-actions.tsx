"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Edit3, KeyRound, Trash2, CheckCircle2, UserX } from "lucide-react";
import { ResetPasswordModal } from "@/components/auth/reset-password-modal";
import { DeleteUserModal } from "@/components/auth/delete-user-modal";
import {
  resetAdminPasswordAction,
  deleteAdminAction,
  toggleAdminStatusAction,
} from "@/lib/actions/admin-actions";

interface AdminRowActionsProps {
  admin: {
    id: string;
    name: string;
    email: string;
    isActive: boolean;
    deletedAt: Date | null;
  };
  currentUserId: string;
}

export function AdminRowActions({ admin, currentUserId }: AdminRowActionsProps) {
  const [showResetModal, setShowResetModal] = React.useState(false);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [isToggling, setIsToggling] = React.useState(false);

  const isSelf = admin.id === currentUserId;
  const isDeleted = admin.deletedAt !== null;

  if (isDeleted) {
    return (
      <span className="text-xs italic text-slate-400">
        Account Deleted
      </span>
    );
  }

  const handleToggleStatus = async () => {
    const actionLabel = admin.isActive ? "deactivate" : "activate";
    if (!confirm(`Are you sure you want to ${actionLabel} this administrator?`)) {
      return;
    }

    setIsToggling(true);
    try {
      await toggleAdminStatusAction({
        userId: admin.id,
        isActive: !admin.isActive,
      });
    } catch {
      alert("Failed to change status. Please try again.");
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-end gap-1.5">
        <Link href={`/super-admin/admins/${admin.id}`}>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs flex items-center gap-1"
            title="Edit details"
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span>Edit</span>
          </Button>
        </Link>

        <Button
          data-testid={`reset-admin-pwd-${admin.id}`}
          variant="outline"
          size="sm"
          className="h-8 px-2.5 text-xs flex items-center gap-1 text-amber-700 border-amber-200 hover:bg-amber-50"
          onClick={() => setShowResetModal(true)}
          title="Reset Password"
        >
          <KeyRound className="h-3.5 w-3.5" />
          <span>Reset</span>
        </Button>

        {!isSelf && (
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 px-2 text-xs flex items-center gap-1 ${
              admin.isActive
                ? "text-slate-600 hover:text-rose-600 hover:bg-rose-50"
                : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
            }`}
            onClick={handleToggleStatus}
            isLoading={isToggling}
            title={admin.isActive ? "Deactivate" : "Activate"}
          >
            {admin.isActive ? (
              <>
                <UserX className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Deactivate</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Activate</span>
              </>
            )}
          </Button>
        )}

        {!isSelf && (
          <Button
            data-testid={`delete-admin-btn-${admin.id}`}
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs flex items-center gap-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            onClick={() => setShowDeleteModal(true)}
            title="Delete Account"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </Button>
        )}
      </div>

      {/* Modals */}
      <ResetPasswordModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        userId={admin.id}
        userName={admin.name}
        userEmail={admin.email}
        roleLabel="admin"
        onReset={resetAdminPasswordAction}
      />

      <DeleteUserModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        userId={admin.id}
        userName={admin.name}
        userEmail={admin.email}
        roleLabel="admin"
        onDelete={deleteAdminAction}
      />
    </>
  );
}
