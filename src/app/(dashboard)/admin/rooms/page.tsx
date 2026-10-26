import React from "react";
import { requireRole } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getRoomsAction } from "@/lib/actions/room-management-actions";
import { getBranchesAction } from "@/lib/actions/branch-actions";
import { RoomsClient } from "@/components/rooms/rooms-client";

export const metadata = {
  title: "Rooms | Guild Club Services",
};

export default async function AdminRoomsPage() {
  const user = await requireRole("admin", "super_admin");

  const [roomsRes, branchesRes] = await Promise.all([
    getRoomsAction(),
    getBranchesAction(true),
  ]);

  const initialRooms = roomsRes.success && roomsRes.data ? roomsRes.data : [];
  const branches = branchesRes.success && branchesRes.branches ? branchesRes.branches : [];

  return (
    <DashboardShell user={user} title="Rooms">
      <RoomsClient initialRooms={initialRooms} branches={branches} />
    </DashboardShell>
  );
}
