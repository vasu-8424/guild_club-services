import React from "react";
import { requireRole } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getTherapistNotesAction } from "@/lib/actions/admin-notes-actions";
import { TherapistNotesClient } from "./therapist-notes-client";

export const metadata = {
  title: "Notes from Admin | Guild Club Services",
};

export default async function TherapistNotesPage() {
  const user = await requireRole("therapist");

  const res = await getTherapistNotesAction();
  const notes = res.success && res.data ? res.data : [];

  return (
    <DashboardShell user={user} title="Notes from Admin">
      <TherapistNotesClient initialNotes={notes} />
    </DashboardShell>
  );
}
