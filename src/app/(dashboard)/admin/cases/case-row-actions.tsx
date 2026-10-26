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
      key: "reassign-therapist",
      label: "Reassign case to another therapist",
      icon: <Icons.UserPlus />,
      onClick: () => router.push(`/admin/cases/${caseId}#reassign`),
      "data-testid": `reassign-case-${caseId}`,
    },
    {
      key: "case-notes",
      label: "View progress report",
      icon: <Icons.FileText />,
      onClick: () => router.push(`/admin/cases/${caseId}/report`),
      "data-testid": `report-case-${caseId}`,
    },
  ];

  return (
    <div className="flex items-center justify-end gap-2 w-full max-w-[220px] ml-auto">
      <Button
        size="sm"
        variant="secondary"
        leadingIcon={<Icons.Eye />}
        onClick={() => router.push(`/admin/cases/${caseId}`)}
        title="View Case"
        data-testid={`primary-view-${caseId}`}
      >
        View Case
      </Button>

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
