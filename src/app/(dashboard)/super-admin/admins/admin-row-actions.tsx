"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { RowActionsMenu, RowActionMenuItem } from "@/components/ui/row-actions-menu";
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
  const router = useRouter();
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

  const menuItems: RowActionMenuItem[] = [
    {
      key: "reset-password",
      label: "Reset password",
      icon: <Icons.ArrowCounterClockwise />,
      onClick: () => setShowResetModal(true),
      variant: "warning",
      "data-testid": `reset-admin-pwd-${admin.id}`,
    },
  ];

  if (!isSelf) {
    menuItems.push({
      key: "toggle-status",
      label: admin.isActive ? "Deactivate admin" : "Activate admin",
      icon: admin.isActive ? <Icons.X /> : <Icons.Check />,
      onClick: handleToggleStatus,
      disabled: isToggling,
      "data-testid": `toggle-admin-btn-${admin.id}`,
    });

    menuItems.push({
      key: "delete",
      label: "Delete admin",
      icon: <Icons.Trash />,
      onClick: () => setShowDeleteModal(true),
      variant: "destructive",
      isDividerBefore: true,
      "data-testid": `delete-admin-btn-${admin.id}`,
    });
  }

  return (
    <>
      <div className="flex items-center justify-end gap-2 w-full max-w-[220px] ml-auto">
        {/* Visible Primary Row Action: Edit */}
        <Button
          data-testid={`edit-admin-btn-${admin.id}`}
          variant="secondary"
          size="sm"
          leadingIcon={<Icons.PencilSimple />}
          onClick={() => router.push(`/super-admin/admins/${admin.id}`)}
          title="Edit details"
        >
          Edit
        </Button>

        {/* Kebab dropdown for secondary & dangerous actions */}
        <RowActionsMenu
          items={menuItems}
          triggerTestId={`row-actions-kebab-${admin.id}`}
          menuTestId={`row-actions-menu-${admin.id}`}
          buttonTitle="More actions"
        />
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
