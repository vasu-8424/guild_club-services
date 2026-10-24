"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Edit3, KeyRound, Trash2, CheckCircle2, UserX, DoorOpen } from "lucide-react";
import { ResetPasswordModal } from "@/components/auth/reset-password-modal";
import { DeleteUserModal } from "@/components/auth/delete-user-modal";
import { AssignRoomModal } from "@/components/therapists/assign-room-modal";
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
  const [showResetModal, setShowResetModal] = React.useState(false);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [showRoomModal, setShowRoomModal] = React.useState(false);
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
      // Fallback
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

  return (
    <>
      <div className="flex items-center justify-end gap-1.5">
        <Button
          data-testid={`assign-room-button-${therapist.id}`}
          variant="outline"
          size="sm"
          className="h-8 px-2.5 text-xs flex items-center gap-1 text-teal-700 border-teal-200 hover:bg-teal-50"
          onClick={() => setShowRoomModal(true)}
          title="Assign Room"
        >
          <DoorOpen className="h-3.5 w-3.5" />
          <span>Assign Room</span>
        </Button>

        <Link href={`/admin/therapists/${therapist.id}`}>
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
          data-testid={`reset-therapist-pwd-${therapist.id}`}
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
              therapist.isActive
                ? "text-slate-600 hover:text-rose-600 hover:bg-rose-50"
                : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
            }`}
            onClick={handleToggleStatus}
            isLoading={isToggling}
            title={therapist.isActive ? "Deactivate" : "Activate"}
          >
            {therapist.isActive ? (
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
            data-testid={`delete-therapist-btn-${therapist.id}`}
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs flex items-center gap-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            onClick={handleOpenDelete}
            title="Delete Account"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </Button>
        )}
      </div>

      {/* Modals */}
      <AssignRoomModal
        isOpen={showRoomModal}
        onClose={() => setShowRoomModal(false)}
        therapistId={therapist.id}
        therapistName={therapist.name}
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
    </>
  );
}
