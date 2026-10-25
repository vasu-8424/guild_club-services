"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { RowActionsMenu, RowActionMenuItem } from "@/components/ui/row-actions-menu";

interface CaseRowActionsProps {
  caseId: string;
  isAssigned: boolean;
}

export function CaseRowActions({ caseId, isAssigned }: CaseRowActionsProps) {
  const router = useRouter();

  const menuItems: RowActionMenuItem[] = [
    {
      key: "view-details",
      label: "View case details",
      icon: <Icons.Eye />,
      onClick: () => router.push(`/admin/cases/${caseId}`),
      "data-testid": `view-case-${caseId}`,
    },
    {
      key: "assign-therapist",
      label: isAssigned ? "Reassign therapist" : "Assign therapist",
      icon: <Icons.UserPlus />,
      onClick: () => router.push(`/admin/cases/${caseId}#assign`),
      "data-testid": `assign-case-${caseId}`,
    },
    {
      key: "case-notes",
      label: "View clinical notes",
      icon: <Icons.FileText />,
      onClick: () => router.push(`/admin/cases/${caseId}#notes`),
      "data-testid": `notes-case-${caseId}`,
    },
  ];

  return (
    <div className="flex items-center justify-end gap-2 w-full max-w-[220px] ml-auto">
      {/* Primary Visible Button: Assign if unassigned, View if assigned */}
      {!isAssigned ? (
        <Button
          size="sm"
          variant="primary"
          leadingIcon={<Icons.UserPlus />}
          onClick={() => router.push(`/admin/cases/${caseId}`)}
          title="Assign therapist"
          data-testid={`primary-assign-${caseId}`}
        >
          Assign
        </Button>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          leadingIcon={<Icons.Eye />}
          onClick={() => router.push(`/admin/cases/${caseId}`)}
          title="View case details"
          data-testid={`primary-view-${caseId}`}
        >
          View
        </Button>
      )}

      {/* Dropdown Kebab Menu */}
      <RowActionsMenu
        items={menuItems}
        triggerTestId={`case-kebab-${caseId}`}
        menuTestId={`case-menu-${caseId}`}
        buttonTitle="More case actions"
      />
    </div>
  );
}
