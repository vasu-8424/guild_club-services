"use client";

import * as React from "react";
import { Tabs } from "@/components/ui/tabs";
import { FileText, Calendar, MessageSquare, History } from "lucide-react";

interface CaseDetailTabsProps {
  overviewContent: React.ReactNode;
  sessionsContent: React.ReactNode;
  notesContent: React.ReactNode;
  historyContent: React.ReactNode;
  sessionsCount: number;
  notesCount: number;
  historyCount: number;
}

export function CaseDetailTabs({
  overviewContent,
  sessionsContent,
  notesContent,
  historyContent,
  sessionsCount,
  notesCount,
  historyCount,
}: CaseDetailTabsProps) {
  const [activeTab, setActiveTab] = React.useState("overview");

  return (
    <div className="space-y-4">
      <Tabs
        tabs={[
          {
            id: "overview",
            label: "Overview",
            icon: <FileText className="h-4 w-4" />,
          },
          {
            id: "sessions",
            label: "Sessions",
            badge: sessionsCount,
            icon: <Calendar className="h-4 w-4" />,
          },
          {
            id: "notes",
            label: "Clinical Notes",
            badge: notesCount,
            icon: <MessageSquare className="h-4 w-4" />,
          },
          {
            id: "history",
            label: "Audit History",
            badge: historyCount,
            icon: <History className="h-4 w-4" />,
          },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      <div>
        {activeTab === "overview" && overviewContent}
        {activeTab === "sessions" && sessionsContent}
        {activeTab === "notes" && notesContent}
        {activeTab === "history" && historyContent}
      </div>
    </div>
  );
}
