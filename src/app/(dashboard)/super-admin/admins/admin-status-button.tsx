"use client";

import * as React from "react";
import { toggleAdminStatusAction } from "@/lib/actions/admin-actions";
import { Button } from "@/components/ui/button";
import { CheckCircle2, UserX } from "lucide-react";

interface AdminStatusButtonProps {
  userId: string;
  currentStatus: boolean;
}

export function AdminStatusButton({
  userId,
  currentStatus,
}: AdminStatusButtonProps) {
  const [isLoading, setIsLoading] = React.useState(false);

  const handleToggle = async () => {
    const actionLabel = currentStatus ? "deactivate" : "activate";
    if (!confirm(`Are you sure you want to ${actionLabel} this administrator?`)) {
      return;
    }

    setIsLoading(true);
    try {
      await toggleAdminStatusAction({
        userId,
        isActive: !currentStatus,
      });
    } catch (err) {
      alert("Failed to change status. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`h-8 px-2.5 text-xs flex items-center gap-1 ${
        currentStatus
          ? "text-rose-600 hover:text-rose-700 hover:bg-rose-50"
          : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
      }`}
      onClick={handleToggle}
      isLoading={isLoading}
    >
      {currentStatus ? (
        <>
          <UserX className="h-3.5 w-3.5" />
          <span>Deactivate</span>
        </>
      ) : (
        <>
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Activate</span>
        </>
      )}
    </Button>
  );
}
