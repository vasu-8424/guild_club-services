"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { RowActionsMenu, RowActionMenuItem } from "@/components/ui/row-actions-menu";
import { ResetPasswordModal } from "@/components/auth/reset-password-modal";
import { ResendCredentialsModal } from "@/components/auth/resend-credentials-modal";
import { DeleteUserModal } from "@/components/auth/delete-user-modal";
import { SendNoteDialog } from "@/components/admin/send-note-dialog";
import { LoginActivityModal } from "@/components/therapists/login-activity-modal";
import {
  resetTherapistPasswordAction,
  deleteTherapistAction,
  toggleTherapistStatusAction,
  getTherapistOpenCasesAction,
} from "@/lib/actions/therapist-actions";

interface TherapistRowActionsProps {
  therapist: {
    id: string;
    name: string;
    email: string;
    isActive: boolean;
    deletedAt: Date | null;
  };
  currentUserId: string;
  currentUserRole: string;
}

export function TherapistRowActions({
  therapist,
  currentUserId,
  currentUserRole,
}: TherapistRowActionsProps) {
  const router = useRouter();
  const [showResetModal, setShowResetModal] = React.useState(false);
  const [showResendModal, setShowResendModal] = React.useState(false);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [showSendNoteModal, setShowSendNoteModal] = React.useState(false);
  const [showLoginModal, setShowLoginModal] = React.useState(false);
  const [isToggling, setIsToggling] = React.useState(false);
  const [openCases, setOpenCases] = React.useState<
    Array<{ id: string; caseNumber: string; status: string }>
  >([]);

  const isSelf = therapist.id === currentUserId;
  const isDeleted = therapist.deletedAt !== null;

  if (isDeleted) {
    return (
      <span className="text-xs italic text-slate-400">
        Account Deleted
      </span>
    );
  }

  const handleOpenDelete = async () => {
    try {
      const cases = await getTherapistOpenCasesAction(therapist.id);
      setOpenCases(cases);
    } catch {
      setOpenCases([]);
    }
    setShowDeleteModal(true);
  };

  const handleToggleStatus = async () => {
    const actionLabel = therapist.isActive ? "deactivate" : "activate";
    if (!confirm(`Are you sure you want to ${actionLabel} this therapist?`)) {
      return;
    }

    setIsToggling(true);
    try {
      await toggleTherapistStatusAction({
        userId: therapist.id,
        isActive: !therapist.isActive,
      });
    } catch {
      alert("Failed to change status. Please try again.");
    } finally {
      setIsToggling(false);
    }
  };

  // Build items for kebab menu
  const menuItems: RowActionMenuItem[] = [
    {
      key: "edit",
      label: "Edit profile",
      icon: <Icons.PencilSimple />,
      onClick: () => router.push(`/admin/therapists/${therapist.id}`),
      "data-testid": `edit-therapist-btn-${therapist.id}`,
    },
    {
      key: "resend-credentials",
      label: "Resend credentials",
      icon: <Icons.Envelope />,
      onClick: () => setShowResendModal(true),
      "data-testid": `resend-therapist-cred-${therapist.id}`,
    },
    {
      key: "reset-password",
      label: "Reset password",
      icon: <Icons.ArrowCounterClockwise />,
      onClick: () => setShowResetModal(true),
      variant: "warning",
      "data-testid": `reset-therapist-pwd-${therapist.id}`,
    },
    {
      key: "login-activity",
      label: "Login activity",
      icon: <Icons.Clock />,
      onClick: () => setShowLoginModal(true),
      "data-testid": `login-activity-btn-${therapist.id}`,
    },
  ];

  if (!isSelf) {
    menuItems.push({
      key: "toggle-status",
      label: therapist.isActive ? "Deactivate practitioner" : "Activate practitioner",
      icon: therapist.isActive ? <Icons.X /> : <Icons.Check />,
      onClick: handleToggleStatus,
      disabled: isToggling,
      "data-testid": `toggle-therapist-btn-${therapist.id}`,
    });

    menuItems.push({
      key: "delete",
      label: "Delete practitioner",
      icon: <Icons.Trash />,
      onClick: handleOpenDelete,
      variant: "destructive",
      isDividerBefore: true,
      "data-testid": `delete-therapist-btn-${therapist.id}`,
    });
  }

  return (
    <>
      <div className="flex items-center justify-end gap-2 w-full max-w-[220px] ml-auto">
        {/* Single Primary Row Action: Send Note */}
        <Button
          data-testid={`send-note-button-${therapist.id}`}
          variant="primary"
          size="sm"
          leadingIcon={<Icons.Envelope />}
          onClick={() => setShowSendNoteModal(true)}
          title="Send Note"
        >
          Send note
        </Button>

        {/* Kebab Dropdown Menu for secondary & dangerous actions */}
        <RowActionsMenu
          items={menuItems}
          triggerTestId={`row-actions-kebab-${therapist.id}`}
          menuTestId={`row-actions-menu-${therapist.id}`}
          buttonTitle="More actions"
        />
      </div>

      {/* Modals */}
      <SendNoteDialog
        isOpen={showSendNoteModal}
        onClose={() => setShowSendNoteModal(false)}
        therapistId={therapist.id}
        therapistName={therapist.name}
      />

      <ResendCredentialsModal
        isOpen={showResendModal}
        onClose={() => setShowResendModal(false)}
        userId={therapist.id}
        userName={therapist.name}
        userEmail={therapist.email}
        roleLabel="therapist"
      />
      <ResetPasswordModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        userId={therapist.id}
        userName={therapist.name}
        userEmail={therapist.email}
        roleLabel="therapist"
        onReset={resetTherapistPasswordAction}
      />

      <DeleteUserModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        userId={therapist.id}
        userName={therapist.name}
        userEmail={therapist.email}
        roleLabel="therapist"
        openCases={openCases}
        onDelete={deleteTherapistAction}
      />

      <LoginActivityModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        therapistId={therapist.id}
        therapistName={therapist.name}
      />
    </>
  );
}
