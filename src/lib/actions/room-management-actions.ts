"use server";

import { z } from "zod";
import { eq, and, ne, isNull, sql, desc, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { rooms, cases, branches, clients, users } from "@/db/schema";
import { requireRole, getCurrentUser } from "@/lib/session";
import { recordEvent } from "@/lib/events";
import { formatToISTDateString } from "@/lib/date-utils";

export interface RoomListItem {
  id: string;
  roomNo: string;
  branchId: string;
  branchName: string;
  isActive: boolean;
  status: "FREE" | "OCCUPIED" | "INACTIVE";
  currentPatient: string; // "GCP-0001 - Patient Name" or "—"
  patientId: string | null;
  patientName: string | null;
  therapist: string; // "Therapist Name" or "—"
  since: string; // Date or "—"
  caseId: string | null;
  hasEverBeenUsed: boolean;
  createdAt: string;
}

export interface GetRoomsFilters {
  branchId?: string;
  status?: "all" | "free" | "occupied" | "inactive";
  search?: string;
}

/**
 * Fetch all rooms with dynamic occupancy status calculated from open cases.
 */
export async function getRoomsAction(
  filters?: GetRoomsFilters
): Promise<{ success: boolean; data?: RoomListItem[]; error?: string }> {
  try {
    const user = await requireRole("admin", "super_admin");
    if (!user) return { success: false, error: "Unauthorized" };

    // Query rooms with their branch
    const allRooms = await db
      .select({
        id: rooms.id,
        roomNo: rooms.roomNo,
        branchId: rooms.branchId,
        branchName: branches.name,
        isActive: rooms.isActive,
        createdAt: rooms.createdAt,
      })
      .from(rooms)
      .innerJoin(branches, eq(rooms.branchId, branches.id))
      .orderBy(asc(branches.name), asc(rooms.roomNo));

    // Query all open cases that currently have a room_id
    const openCases = await db
      .select({
        caseId: cases.id,
        roomId: cases.roomId,
        patientId: cases.patientId,
        clientName: clients.fullName,
        therapistName: users.name,
        startDate: cases.startDate,
        createdAt: cases.createdAt,
      })
      .from(cases)
      .innerJoin(clients, eq(cases.clientId, clients.id))
      .leftJoin(users, eq(cases.currentTherapistId, users.id))
      .where(and(ne(cases.status, "completed"), sql`${cases.roomId} IS NOT NULL`));

    // Map open cases by roomId
    const openCaseMap = new Map<string, (typeof openCases)[0]>();
    for (const oc of openCases) {
      if (oc.roomId) {
        openCaseMap.set(oc.roomId, oc);
      }
    }

    // Query ever-used room IDs (any case referencing room_id)
    const usedRoomRows = await db
      .selectDistinct({ roomId: cases.roomId })
      .from(cases)
      .where(sql`${cases.roomId} IS NOT NULL`);
    const usedRoomIds = new Set<string>(
      usedRoomRows.map((r) => r.roomId).filter(Boolean) as string[]
    );

    // Compute status and assemble items
    let items: RoomListItem[] = allRooms.map((r) => {
      const openCase = openCaseMap.get(r.id);
      let status: "FREE" | "OCCUPIED" | "INACTIVE" = "FREE";

      if (!r.isActive) {
        status = "INACTIVE";
      } else if (openCase) {
        status = "OCCUPIED";
      } else {
        status = "FREE";
      }

      let currentPatient = "—";
      let therapist = "—";
      let since = "—";

      if (openCase) {
        currentPatient = `${openCase.patientId || "N/A"} - ${openCase.clientName || "Patient"}`;
        therapist = openCase.therapistName || "Assigned Therapist";
        since = openCase.startDate
          ? String(openCase.startDate)
          : formatToISTDateString(openCase.createdAt);
      }

      return {
        id: r.id,
        roomNo: r.roomNo,
        branchId: r.branchId,
        branchName: r.branchName,
        isActive: r.isActive,
        status,
        currentPatient,
        patientId: openCase?.patientId || null,
        patientName: openCase?.clientName || null,
        therapist,
        since,
        caseId: openCase?.caseId || null,
        hasEverBeenUsed: usedRoomIds.has(r.id),
        createdAt: r.createdAt.toISOString(),
      };
    });

    // Apply filters
    if (filters?.branchId && filters.branchId !== "all") {
      items = items.filter((item) => item.branchId === filters.branchId);
    }
    if (filters?.status && filters.status !== "all") {
      items = items.filter(
        (item) => item.status.toLowerCase() === filters.status!.toLowerCase()
      );
    }
    if (filters?.search && filters.search.trim()) {
      const term = filters.search.trim().toLowerCase();
      items = items.filter(
        (item) =>
          item.roomNo.toLowerCase().includes(term) ||
          item.branchName.toLowerCase().includes(term) ||
          item.currentPatient.toLowerCase().includes(term) ||
          item.therapist.toLowerCase().includes(term)
      );
    }

    return { success: true, data: items };
  } catch (error: any) {
    console.error("getRoomsAction error:", error);
    return { success: false, error: error?.message || "Failed to fetch rooms" };
  }
}

const createRoomSchema = z.object({
  roomNo: z.string().trim().min(1, "Room number is required."),
  branchId: z.string().uuid("Please select a valid branch."),
});

/**
 * Admin / Super Admin creates a single room.
 */
export async function createRoomAction(data: {
  roomNo: string;
  branchId: string;
}): Promise<{ success: boolean; error?: string; roomId?: string }> {
  try {
    const user = await requireRole("admin", "super_admin");
    const parsed = createRoomSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
    }

    const { roomNo, branchId } = parsed.data;
    const cleanRoomNo = roomNo.trim();

    // Check duplicate in branch (case-insensitive & trimmed)
    const existing = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(
        and(
          eq(rooms.branchId, branchId),
          sql`lower(trim(${rooms.roomNo})) = lower(trim(${cleanRoomNo}))`
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return {
        success: false,
        error: "A room with this number already exists in this branch.",
      };
    }

    const result = await db.transaction(async (tx) => {
      const [newRoom] = await tx
        .insert(rooms)
        .values({
          roomNo: cleanRoomNo,
          branchId,
          isActive: true,
          createdBy: user.id,
        })
        .returning({ id: rooms.id });

      await recordEvent(tx, {
        eventType: "room_created",
        actorId: user.id,
        actorRole: user.role,
        metadata: {
          roomId: newRoom.id,
          roomNo: cleanRoomNo,
          branchId,
        },
      });

      return newRoom;
    });

    revalidatePath("/admin/rooms");
    revalidatePath("/admin/dashboard");

    return { success: true, roomId: result.id };
  } catch (error: any) {
    if (error?.code === "23505" || error?.message?.includes("rooms_branch_room_no_unique_idx")) {
      return {
        success: false,
        error: "A room with this number already exists in this branch.",
      };
    }
    console.error("createRoomAction error:", error);
    return { success: false, error: error?.message || "Failed to create room." };
  }
}

const bulkCreateSchema = z.object({
  prefix: z.string().trim().default(""),
  startNo: z.coerce.number().int().min(1, "Start number must be at least 1."),
  endNo: z.coerce.number().int().min(1, "End number must be at least 1."),
  branchId: z.string().uuid("Please select a valid branch."),
});

/**
 * Bulk create rooms (e.g. prefix "R-", 1 to 10). Skips duplicates and returns summary.
 */
export async function bulkCreateRoomsAction(data: {
  prefix?: string;
  startNo: number;
  endNo: number;
  branchId: string;
}): Promise<{
  success: boolean;
  totalRequested: number;
  createdCount: number;
  skippedCount: number;
  skippedRooms: string[];
  error?: string;
}> {
  try {
    const user = await requireRole("admin", "super_admin");
    const parsed = bulkCreateSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        totalRequested: 0,
        createdCount: 0,
        skippedCount: 0,
        skippedRooms: [],
        error: parsed.error.issues[0]?.message || "Invalid input",
      };
    }

    const { prefix, startNo, endNo, branchId } = parsed.data;

    if (startNo > endNo) {
      return {
        success: false,
        totalRequested: 0,
        createdCount: 0,
        skippedCount: 0,
        skippedRooms: [],
        error: "Start number cannot be greater than end number.",
      };
    }

    const totalRequested = endNo - startNo + 1;
    if (totalRequested > 100) {
      return {
        success: false,
        totalRequested,
        createdCount: 0,
        skippedCount: 0,
        skippedRooms: [],
        error: "Cannot create more than 100 rooms in a single bulk operation.",
      };
    }

    // Fetch existing rooms in this branch
    const existingRows = await db
      .select({ roomNo: rooms.roomNo })
      .from(rooms)
      .where(eq(rooms.branchId, branchId));

    const existingLowerSet = new Set(
      existingRows.map((r) => r.roomNo.trim().toLowerCase())
    );

    const roomsToCreate: string[] = [];
    const skippedRooms: string[] = [];

    for (let num = startNo; num <= endNo; num++) {
      const candidate = `${prefix}${num}`.trim();
      const lower = candidate.toLowerCase();
      if (existingLowerSet.has(lower)) {
        skippedRooms.push(candidate);
      } else {
        existingLowerSet.add(lower);
        roomsToCreate.push(candidate);
      }
    }

    if (roomsToCreate.length > 0) {
      await db.transaction(async (tx) => {
        for (const rNo of roomsToCreate) {
          const [inserted] = await tx
            .insert(rooms)
            .values({
              roomNo: rNo,
              branchId,
              isActive: true,
              createdBy: user.id,
            })
            .returning({ id: rooms.id });

          await recordEvent(tx, {
            eventType: "room_created",
            actorId: user.id,
            actorRole: user.role,
            metadata: {
              roomId: inserted.id,
              roomNo: rNo,
              branchId,
              isBulk: true,
            },
          });
        }
      });
    }

    revalidatePath("/admin/rooms");
    revalidatePath("/admin/dashboard");

    return {
      success: true,
      totalRequested,
      createdCount: roomsToCreate.length,
      skippedCount: skippedRooms.length,
      skippedRooms,
    };
  } catch (error: any) {
    console.error("bulkCreateRoomsAction error:", error);
    return {
      success: false,
      totalRequested: 0,
      createdCount: 0,
      skippedCount: 0,
      skippedRooms: [],
      error: error?.message || "Failed to bulk create rooms.",
    };
  }
}

/**
 * Rename room only when it is FREE.
 */
export async function updateRoomAction(data: {
  id: string;
  roomNo: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireRole("admin", "super_admin");
    const cleanRoomNo = data.roomNo?.trim();
    if (!cleanRoomNo) {
      return { success: false, error: "Room number cannot be empty." };
    }

    // Verify room exists
    const [room] = await db.select().from(rooms).where(eq(rooms.id, data.id)).limit(1);
    if (!room) {
      return { success: false, error: "Room not found." };
    }

    // Check if room is OCCUPIED
    const [openCase] = await db
      .select({ id: cases.id })
      .from(cases)
      .where(and(eq(cases.roomId, data.id), ne(cases.status, "completed")))
      .limit(1);

    if (openCase) {
      return {
        success: false,
        error: "Cannot rename an occupied room. Wait until the active case is closed.",
      };
    }

    // Check duplicate in same branch
    const existing = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(
        and(
          eq(rooms.branchId, room.branchId),
          ne(rooms.id, room.id),
          sql`lower(trim(${rooms.roomNo})) = lower(trim(${cleanRoomNo}))`
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return {
        success: false,
        error: "Another room with this number already exists in this branch.",
      };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(rooms)
        .set({ roomNo: cleanRoomNo })
        .where(eq(rooms.id, room.id));

      await recordEvent(tx, {
        eventType: "room_updated",
        actorId: user.id,
        actorRole: user.role,
        metadata: {
          roomId: room.id,
          oldRoomNo: room.roomNo,
          newRoomNo: cleanRoomNo,
        },
      });
    });

    revalidatePath("/admin/rooms");
    revalidatePath("/admin/dashboard");

    return { success: true };
  } catch (error: any) {
    console.error("updateRoomAction error:", error);
    return { success: false, error: error?.message || "Failed to update room." };
  }
}

/**
 * Deactivate or activate room. Deactivation allowed only when FREE.
 */
export async function toggleRoomActiveAction(data: {
  id: string;
  isActive: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireRole("admin", "super_admin");

    const [room] = await db.select().from(rooms).where(eq(rooms.id, data.id)).limit(1);
    if (!room) {
      return { success: false, error: "Room not found." };
    }

    // If deactivating, ensure it is FREE
    if (!data.isActive) {
      const [openCase] = await db
        .select({ id: cases.id })
        .from(cases)
        .where(and(eq(cases.roomId, data.id), ne(cases.status, "completed")))
        .limit(1);

      if (openCase) {
        return {
          success: false,
          error: "Cannot deactivate an occupied room. Wait until the active case is closed.",
        };
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(rooms)
        .set({ isActive: data.isActive })
        .where(eq(rooms.id, room.id));

      await recordEvent(tx, {
        eventType: data.isActive ? "room_updated" : "room_deactivated",
        actorId: user.id,
        actorRole: user.role,
        metadata: {
          roomId: room.id,
          roomNo: room.roomNo,
          isActive: data.isActive,
        },
      });
    });

    revalidatePath("/admin/rooms");
    revalidatePath("/admin/dashboard");

    return { success: true };
  } catch (error: any) {
    console.error("toggleRoomActiveAction error:", error);
    return { success: false, error: error?.message || "Failed to toggle room status." };
  }
}

/**
 * Delete a room. A room cannot be deleted if it has ever been used.
 */
export async function deleteRoomAction(data: {
  id: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireRole("admin", "super_admin");

    const [room] = await db.select().from(rooms).where(eq(rooms.id, data.id)).limit(1);
    if (!room) {
      return { success: false, error: "Room not found." };
    }

    // Check if room has ever been referenced by any case (open or closed)
    const [caseRef] = await db
      .select({ id: cases.id })
      .from(cases)
      .where(eq(cases.roomId, data.id))
      .limit(1);

    if (caseRef) {
      return {
        success: false,
        error:
          "This room has historical case records and cannot be deleted. Deactivate it instead.",
      };
    }

    await db.transaction(async (tx) => {
      await tx.delete(rooms).where(eq(rooms.id, room.id));

      await recordEvent(tx, {
        eventType: "room_deleted",
        actorId: user.id,
        actorRole: user.role,
        metadata: {
          roomId: room.id,
          roomNo: room.roomNo,
          branchId: room.branchId,
        },
      });
    });

    revalidatePath("/admin/rooms");
    revalidatePath("/admin/dashboard");

    return { success: true };
  } catch (error: any) {
    console.error("deleteRoomAction error:", error);
    return { success: false, error: error?.message || "Failed to delete room." };
  }
}

/**
 * Get active, free rooms for a branch. Used by therapist Create Case dropdown.
 */
export async function getFreeRoomsForBranchAction(branchId: string): Promise<{
  success: boolean;
  rooms?: Array<{ id: string; roomNo: string }>;
  error?: string;
}> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.isActive) {
      return { success: false, error: "Unauthorized" };
    }

    if (!branchId) {
      return { success: true, rooms: [] };
    }

    // Active rooms in this branch
    const branchRooms = await db
      .select({
        id: rooms.id,
        roomNo: rooms.roomNo,
      })
      .from(rooms)
      .where(and(eq(rooms.branchId, branchId), eq(rooms.isActive, true)))
      .orderBy(asc(rooms.roomNo));

    if (branchRooms.length === 0) {
      return { success: true, rooms: [] };
    }

    // Find currently occupied room IDs
    const occupiedRows = await db
      .select({ roomId: cases.roomId })
      .from(cases)
      .where(
        and(
          eq(cases.branchId, branchId),
          ne(cases.status, "completed"),
          sql`${cases.roomId} IS NOT NULL`
        )
      );

    const occupiedSet = new Set(
      occupiedRows.map((r) => r.roomId).filter(Boolean) as string[]
    );

    const freeRooms = branchRooms.filter((r) => !occupiedSet.has(r.id));

    return { success: true, rooms: freeRooms };
  } catch (error: any) {
    console.error("getFreeRoomsForBranchAction error:", error);
    return { success: false, error: error?.message || "Failed to load free rooms." };
  }
}

/**
 * Fetch open cases with NULL room_id (e.g. from migration conflicts).
 */
export async function getNullRoomCasesAction(): Promise<{
  success: boolean;
  count: number;
  cases: Array<{
    id: string;
    caseNumber: string;
    patientId: string | null;
    clientName: string;
    branchId: string | null;
    branchName: string;
    therapistName: string;
  }>;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, count: 0, cases: [] };

    const conditions = [
      ne(cases.status, "completed"),
      sql`${cases.roomId} IS NULL`,
    ];

    // If therapist, only show their own null-room cases
    if (user.role === "therapist") {
      conditions.push(eq(cases.currentTherapistId, user.id));
    }

    const rows = await db
      .select({
        id: cases.id,
        caseNumber: cases.caseNumber,
        patientId: cases.patientId,
        clientName: clients.fullName,
        branchId: cases.branchId,
        branchName: branches.name,
        therapistName: users.name,
      })
      .from(cases)
      .innerJoin(clients, eq(cases.clientId, clients.id))
      .leftJoin(branches, eq(cases.branchId, branches.id))
      .leftJoin(users, eq(cases.currentTherapistId, users.id))
      .where(and(...conditions));

    return {
      success: true,
      count: rows.length,
      cases: rows.map((r) => ({
        ...r,
        branchName: r.branchName || "Unassigned Branch",
        therapistName: r.therapistName || "Unassigned Therapist",
      })),
    };
  } catch (error) {
    console.error("getNullRoomCasesAction error:", error);
    return { success: false, count: 0, cases: [] };
  }
}

/**
 * Assign a room once to a case that currently has no room (roomId IS NULL).
 */
export async function assignNullRoomCaseAction(data: {
  caseId: string;
  roomId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const [targetCase] = await db
      .select()
      .from(cases)
      .where(eq(cases.id, data.caseId))
      .limit(1);

    if (!targetCase) return { success: false, error: "Case not found." };

    // Permissions: Admin, Super Admin, or case owner therapist
    if (
      user.role === "therapist" &&
      targetCase.currentTherapistId !== user.id
    ) {
      return {
        success: false,
        error: "Forbidden: You can only assign a room to your own case.",
      };
    }

    if (targetCase.roomId) {
      return {
        success: false,
        error: "This case already has an assigned room. Rooms cannot be changed while open.",
      };
    }

    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, data.roomId))
      .limit(1);

    if (!room || !room.isActive) {
      return { success: false, error: "Selected room is invalid or inactive." };
    }

    if (targetCase.branchId && room.branchId !== targetCase.branchId) {
      return {
        success: false,
        error: "Room must belong to the same branch as the case.",
      };
    }

    await db.transaction(async (tx) => {
      // Check if room is taken
      const [existingOpen] = await tx
        .select({ id: cases.id })
        .from(cases)
        .where(
          and(
            eq(cases.roomId, room.id),
            ne(cases.status, "completed"),
            ne(cases.id, targetCase.id)
          )
        )
        .limit(1);

      if (existingOpen) {
        throw new Error(
          "This room was just taken by another patient. Please choose another room."
        );
      }

      await tx
        .update(cases)
        .set({
          roomId: room.id,
          roomNo: room.roomNo,
          branchId: targetCase.branchId || room.branchId,
        })
        .where(eq(cases.id, targetCase.id));

      await recordEvent(tx, {
        eventType: "case_room_assigned",
        actorId: user.id,
        actorRole: user.role,
        caseId: targetCase.id,
        metadata: {
          roomId: room.id,
          roomNo: room.roomNo,
        },
      });
    });

    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/rooms");
    revalidatePath(`/cases/${targetCase.id}`);

    return { success: true };
  } catch (error: any) {
    if (
      error?.code === "23505" ||
      error?.message?.includes("one_open_case_per_room")
    ) {
      return {
        success: false,
        error:
          "This room was just taken by another patient. Please choose another room.",
      };
    }
    return {
      success: false,
      error: error?.message || "Failed to assign room to case.",
    };
  }
}
