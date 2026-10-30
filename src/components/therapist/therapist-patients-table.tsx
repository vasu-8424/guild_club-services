"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CLINICAL_SERVICES, getServiceLabel } from "@/lib/services";
import {
  Search,
  Plus,
  Check,
  X as CrossIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  FileText,
} from "lucide-react";

export interface TherapistPatientRow {
  id: string;
  patientId: string;
  caseNumber: string;
  clientName: string;
  problem: string;
  presentCondition: string;
  service: string;
  status: string; // 'active' | 'completed' | ...
  hasTodaySession: boolean;
  hasSubmittedReport?: boolean;
}

interface TherapistPatientsTableProps {
  patients: TherapistPatientRow[];
  activeCount: number;
  sessionsDoneToday: number;
  pendingSessionsToday: number;
}

export function TherapistPatientsTable({
  patients,
  activeCount,
  sessionsDoneToday,
  pendingSessionsToday,
}: TherapistPatientsTableProps) {
  const router = useRouter();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Filtered & Searched patients
  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      // Status filter
      if (statusFilter === "active" && p.status === "completed") return false;
      if (statusFilter === "closed" && p.status !== "completed") return false;

      // Service filter
      if (serviceFilter !== "all" && p.service !== serviceFilter) return false;

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesId = p.patientId.toLowerCase().includes(query) || p.caseNumber.toLowerCase().includes(query);
        const matchesName = p.clientName.toLowerCase().includes(query);
        const matchesProblem = p.problem.toLowerCase().includes(query);
        const matchesCondition = p.presentCondition.toLowerCase().includes(query);
        if (!matchesId && !matchesName && !matchesProblem && !matchesCondition) {
          return false;
        }
      }

      return true;
    });
  }, [patients, statusFilter, serviceFilter, searchTerm]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / pageSize));
  const paginatedPatients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPatients.slice(start, start + pageSize);
  }, [filteredPatients, currentPage]);

  return (
    <div className="space-y-6">
      {/* 1. Header with Title and Create Case Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-tight text-stone-900">
            My Patients
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Active and discharged clinical rehabilitation cases
          </p>
        </div>

        <Link
          href="/therapist/cases/new"
          data-testid="create-case-btn"
          className="inline-flex items-center justify-center gap-2 bg-[#0B7A63] hover:bg-[#096350] text-white px-5 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-none shadow-xs transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Create Case</span>
        </Link>
      </div>

      {/* 2. 3 Tiny Counters Above the Table */}
      <div className="grid grid-cols-3 gap-3">
        <div
          data-testid="stat-active-patients"
          className="bg-white border border-stone-200 p-3 rounded-none shadow-2xs"
        >
          <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider block">
            Active Patients
          </span>
          <span
            data-testid="active-patients-counter"
            className="text-2xl font-mono font-bold text-stone-900"
          >
            {activeCount}
          </span>
        </div>

        <div
          data-testid="stat-sessions-done-today"
          className="bg-white border border-stone-200 p-3 rounded-none shadow-2xs"
        >
          <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider block">
            Sessions Done Today
          </span>
          <span
            data-testid="sessions-done-today-counter"
            className="text-2xl font-mono font-bold text-emerald-700"
          >
            {sessionsDoneToday}
          </span>
        </div>

        <div
          data-testid="stat-pending-sessions-today"
          className="bg-white border border-stone-200 p-3 rounded-none shadow-2xs"
        >
          <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider block">
            Pending Sessions Today
          </span>
          <span
            data-testid="pending-sessions-today-counter"
            className="text-2xl font-mono font-bold text-amber-700"
          >
            {pendingSessionsToday}
          </span>
        </div>
      </div>

      {/* 3. Search and Filters Toolbar */}
      <div className="bg-white border border-stone-200 p-3 rounded-none flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            data-testid="search-input"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by ID, name, or problem..."
            className="w-full border border-stone-300 pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-[#0B7A63] rounded-none bg-stone-50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Status Filter */}
          <select
            data-testid="patient-status-filter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="border border-stone-300 px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#0B7A63] rounded-none bg-white text-stone-700"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>

          {/* Service Filter (Only 3 Services) */}
          <select
            data-testid="patient-service-filter"
            value={serviceFilter}
            onChange={(e) => {
              setServiceFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="border border-stone-300 px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#0B7A63] rounded-none bg-white text-stone-700"
          >
            <option value="all">All Services</option>
            {CLINICAL_SERVICES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. One Table (Only 7 Columns) */}
      <div className="bg-white border border-stone-200 rounded-none shadow-xs overflow-hidden">
        {patients.length === 0 ? (
          <div
            data-testid="empty-patients-state"
            className="py-16 px-4 text-center space-y-3"
          >
            <p className="text-sm font-semibold text-stone-700">
              No patients yet. Create your first case.
            </p>
            <p className="text-xs text-stone-400 max-w-sm mx-auto">
              Start by registering a new patient intake and documenting initial condition photos.
            </p>
            <div className="pt-2">
              <Link
                href="/therapist/cases/new"
                className="inline-flex items-center gap-1.5 bg-[#0B7A63] hover:bg-[#096350] text-white px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-none"
              >
                <Plus className="w-4 h-4" />
                <span>+ Create Case</span>
              </Link>
            </div>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="py-12 px-4 text-center text-xs text-stone-500">
            No matching patients found for current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              data-testid="therapist-patients-table"
              className="w-full text-left text-xs border-collapse"
            >
              <thead>
                <tr className="bg-stone-100 border-b border-stone-200 text-stone-700 uppercase font-semibold">
                  <th className="py-3 px-4 w-28">Patient ID</th>
                  <th className="py-3 px-4 w-40">Patient Name</th>
                  <th className="py-3 px-4">Problem</th>
                  <th className="py-3 px-4">Present Condition</th>
                  <th className="py-3 px-4 w-36">Service</th>
                  <th className="py-3 px-4 w-24">Status</th>
                  <th className="py-3 px-4 w-28 text-center">Today's Session</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {paginatedPatients.map((patient) => {
                  const isClosed = patient.status === "completed";
                  const serviceLabel = getServiceLabel(patient.service);

                  return (
                    <tr
                      key={patient.id}
                      data-testid={`patient-row-${patient.id}`}
                      onClick={() => router.push(`/therapist/cases/${patient.id}`)}
                      className="hover:bg-stone-50 cursor-pointer transition-colors group"
                    >
                      {/* Column 1: Patient ID */}
                      <td className="py-3 px-4 font-mono font-bold text-[#0B7A63] group-hover:underline">
                        {patient.patientId || patient.caseNumber}
                      </td>

                      {/* Column 2: Patient Name */}
                      <td className="py-3 px-4 font-semibold text-stone-900">
                        {patient.clientName}
                      </td>

                      {/* Column 3: Problem */}
                      <td className="py-3 px-4 text-stone-700 max-w-xs truncate">
                        {patient.problem}
                      </td>

                      {/* Column 4: Present Condition */}
                      <td className="py-3 px-4 text-stone-600 max-w-xs truncate">
                        {patient.presentCondition}
                      </td>

                      {/* Column 5: Service Tag */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {serviceLabel}
                        </span>
                      </td>

                      {/* Column 6: Status Tag & Report Indicator */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {isClosed ? (
                            <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold bg-stone-100 text-stone-600 border border-stone-200">
                              Closed
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Active
                            </span>
                          )}
                          {patient.hasSubmittedReport ? (
                            <FileText
                              className="w-3.5 h-3.5 text-[#0B7A63] fill-[#0B7A63] shrink-0"
                              data-testid={`report-indicator-${patient.id}`}
                              aria-label="Progress report submitted"
                            />
                          ) : (
                            <FileText
                              className="w-3.5 h-3.5 text-stone-400 stroke-1 shrink-0"
                              data-testid={`report-indicator-${patient.id}`}
                              aria-label="No submitted report"
                            />
                          )}
                        </div>
                      </td>

                      {/* Column 7: Today's Session Icon */}
                      <td className="py-3 px-4 text-center">
                        {patient.hasTodaySession ? (
                          <span
                            data-testid="today-session-done-icon"
                            title="Session done today"
                            className="inline-flex items-center justify-center w-5 h-5 bg-emerald-100 text-emerald-800 border border-emerald-400 mx-auto"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span
                            data-testid="today-session-pending-icon"
                            title="No session recorded today"
                            className="inline-flex items-center justify-center w-5 h-5 bg-red-100 text-red-800 border border-red-300 mx-auto"
                          >
                            <CrossIcon className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. Pagination Bar */}
        {filteredPatients.length > pageSize && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-stone-200 bg-stone-50 text-xs text-stone-600">
            <span className="text-center sm:text-left">
              Showing {(currentPage - 1) * pageSize + 1} to{" "}
              {Math.min(currentPage * pageSize, filteredPatients.length)} of{" "}
              {filteredPatients.length} patients
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                data-testid="prev-page-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="p-1 min-h-[36px] min-w-[36px] flex items-center justify-center border border-stone-300 disabled:opacity-30 rounded-none hover:bg-stone-100 cursor-pointer"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-mono">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                data-testid="next-page-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="p-1 min-h-[36px] min-w-[36px] flex items-center justify-center border border-stone-300 disabled:opacity-30 rounded-none hover:bg-stone-100 cursor-pointer"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
