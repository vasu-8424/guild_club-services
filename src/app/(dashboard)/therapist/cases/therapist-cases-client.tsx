"use client";

import * as React from "react";
import Link from "next/link";
import { Search, HeartHandshake, ArrowRight, UserCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { acceptCaseAction, declineCaseAction } from "@/lib/actions/case-actions";

export interface CaseListItem {
  id: string;
  caseNumber: string;
  category: string;
  priority: string;
  status: string;
  createdAt: Date;
  clientName: string;
  clientPhone: string;
}

interface TherapistCasesClientProps {
  pendingCases: CaseListItem[];
  activeCases: CaseListItem[];
}

export function TherapistCasesClient({
  pendingCases: initialPending,
  activeCases: initialActive,
}: TherapistCasesClientProps) {
  const [pendingCases, setPendingCases] = React.useState(initialPending);
  const [activeCases, setActiveCases] = React.useState(initialActive);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<"all" | "pending" | "active">("all");
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null);

  const handleAccept = async (caseId: string) => {
    setActionLoadingId(caseId);
    try {
      const res = await acceptCaseAction({ caseId });
      if (res.success) {
        const accepted = pendingCases.find((c) => c.id === caseId);
        setPendingCases((prev) => prev.filter((c) => c.id !== caseId));
        if (accepted) {
          setActiveCases((prev) => [{ ...accepted, status: "accepted" }, ...prev]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDecline = async (caseId: string) => {
    const reason = prompt("Please provide a brief reason for declining this case invitation:");
    if (!reason || !reason.trim()) return;

    setActionLoadingId(caseId);
    try {
      const res = await declineCaseAction({
        caseId,
        reason: reason.trim(),
      });
      if (res.success) {
        setPendingCases((prev) => prev.filter((c) => c.id !== caseId));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const matchesSearch = (item: CaseListItem) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.caseNumber.toLowerCase().includes(q) ||
      item.clientName.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  };

  const filteredPending = pendingCases.filter(matchesSearch);
  const filteredActive = activeCases.filter(matchesSearch);

  return (
    <div className="space-y-6">
      {/* Search Bar & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-px">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all ${
              activeTab === "all"
                ? "border-teal-700 text-teal-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            All Caseload ({pendingCases.length + activeCases.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "pending"
                ? "border-teal-700 text-teal-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>Pending Invitations</span>
            {pendingCases.length > 0 && (
              <span className="rounded-full bg-rose-100 text-rose-700 px-1.5 py-0.2 text-[10px] font-bold">
                {pendingCases.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("active")}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all ${
              activeTab === "active"
                ? "border-teal-700 text-teal-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Active Treatment ({activeCases.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search cases or clients..."
            className="pl-9 h-9 text-xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Pending Invitations Section */}
      {(activeTab === "all" || activeTab === "pending") && filteredPending.length > 0 && (
        <div className="rounded-xl border border-teal-200/90 bg-white overflow-hidden shadow-xs">
          <div className="border-b border-teal-100 bg-teal-50/50 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-teal-700" />
              <h2 className="text-sm font-semibold text-teal-900">
                Awaiting Response (Invitations)
              </h2>
            </div>
            <span className="text-xs font-medium text-teal-700">
              {filteredPending.length} invitation{filteredPending.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredPending.map((c) => (
              <div
                key={c.id}
                data-testid={`invitation-row-${c.caseNumber}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-slate-50/50 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-slate-900">
                      {c.caseNumber}
                    </span>
                    <PriorityBadge priority={c.priority} />
                    <span className="rounded bg-teal-50 border border-teal-200 px-2 py-0.5 text-[11px] font-medium text-teal-800">
                      {c.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Client: <strong className="font-semibold text-slate-800">{c.clientName}</strong> · Phone: {c.clientPhone}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    data-testid="invitation-accept-button"
                    onClick={() => handleAccept(c.id)}
                    isLoading={actionLoadingId === c.id}
                    className="bg-teal-700 hover:bg-teal-800 text-white text-xs h-8 px-3"
                  >
                    Accept Case
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="invitation-decline-button"
                    onClick={() => handleDecline(c.id)}
                    isLoading={actionLoadingId === c.id}
                    className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs h-8 px-3"
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Treatment Caseload */}
      {(activeTab === "all" || activeTab === "active") && (
        <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden shadow-xs">
          <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HeartHandshake className="h-4 w-4 text-teal-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                Active Treatment Caseload
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              {filteredActive.length} active case{filteredActive.length === 1 ? "" : "s"}
            </span>
          </div>

          {filteredActive.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No active cases found"
                description={
                  searchQuery
                    ? "No active cases match your search query."
                    : "You currently have no active cases assigned."
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50/90 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-5 py-3">Case</th>
                    <th className="px-5 py-3">Client</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Priority</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredActive.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                        {c.caseNumber}
                      </td>
                      <td className="px-5 py-3.5 text-slate-900 font-semibold">
                        {c.clientName}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {c.category}
                      </td>
                      <td className="px-5 py-3.5">
                        <PriorityBadge priority={c.priority} />
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link href={`/therapist/cases/${c.id}`}>
                          <Button variant="outline" size="sm" className="h-7 text-xs">
                            <span>Open Details</span>
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
