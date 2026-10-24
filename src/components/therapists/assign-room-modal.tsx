"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Icons } from "@/components/ui/icons";

const DoorOpen = Icons.Room;
const Check = Icons.Check;
const AlertCircle = Icons.Alert;
import { assignTherapistRoomAction } from "@/lib/actions/room-actions";
import { getTodayIST } from "@/lib/date-utils";

interface AssignRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  therapistId: string;
  therapistName: string;
}

export function AssignRoomModal({
  isOpen,
  onClose,
  therapistId,
  therapistName,
}: AssignRoomModalProps) {
  const [assignedDate, setAssignedDate] = React.useState(getTodayIST());
  const [roomNo, setRoomNo] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setAssignedDate(getTodayIST());
      setRoomNo("");
      setError(null);
      setSuccess(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNo.trim()) {
      setError("Please enter a room number.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await assignTherapistRoomAction({
        therapistId,
        assignedDate,
        roomNo: roomNo.trim(),
      });

      if (!res.success) {
        setError(res.error || "Failed to assign room.");
      } else {
        setSuccess(`Assigned ${roomNo.trim()} to ${therapistName} for ${assignedDate}.`);
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-teal-800">
            <DoorOpen className="h-5 w-5 text-teal-700" />
            <DialogTitle>Assign Consultation Room</DialogTitle>
          </div>
          <DialogDescription>
            Assign a therapy room to <strong className="text-slate-800 font-semibold">{therapistName}</strong> for a specific date.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div data-testid="assign-room-error-message" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div data-testid="assign-room-success-message" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800">
              <Check className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <div className="space-y-3">
            <Input
              label="Assigned Date"
              type="date"
              data-testid="assign-room-date-input"
              value={assignedDate}
              onChange={(e) => setAssignedDate(e.target.value)}
              required
            />

            <Input
              label="Room Number / Designation"
              placeholder="e.g. Room 101, Consultation Suite A"
              data-testid="assign-room-input"
              value={roomNo}
              onChange={(e) => setRoomNo(e.target.value)}
              required
              autoFocus
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              data-testid="assign-room-submit-button"
              isLoading={loading}
              className="bg-teal-700 hover:bg-teal-800 text-white"
            >
              Confirm Assignment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
