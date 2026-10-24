"use server";

import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { therapistRoomAssignments, users } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { recordEvent } from "@/lib/events";
import { revalidatePath } from "next/cache";

const assignRoomSchema = z.object({
  therapistId: z.string().uuid("Invalid therapist ID"),
  assignedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be formatted as YYYY-MM-DD"),
  roomNo: z.string().min(1, "Room number is required").max(50),
});

export type AssignRoomInput = z.infer<typeof assignRoomSchema>;

export async function assignTherapistRoomAction(data: AssignRoomInput) {
  try {
    const user = await requireRole("admin", "super_admin");
    const parsed = assignRoomSchema.parse(data);

    // Verify therapist exists and is a therapist
    const [therapist] = await db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(and(eq(users.id, parsed.therapistId), eq(users.role, "therapist")))
      .limit(1);

    if (!therapist) {
      return { success: false, error: "Therapist not found." };
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      // Upsert room assignment on conflict on (therapist_id, assigned_date)
      await tx
        .insert(therapistRoomAssignments)
        .values({
          therapistId: parsed.therapistId,
          assignedDate: parsed.assignedDate,
          roomNo: parsed.roomNo.trim(),
          createdBy: user.id,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: [
            therapistRoomAssignments.therapistId,
            therapistRoomAssignments.assignedDate,
          ],
          set: {
            roomNo: parsed.roomNo.trim(),
            createdBy: user.id,
            createdAt: now,
          },
        });

      // Record audit event
      await recordEvent(tx, {
        eventType: "room_assigned",
        actorId: user.id,
        actorRole: user.role,
        targetUserId: parsed.therapistId,
        metadata: {
          therapistId: parsed.therapistId,
          assignedDate: parsed.assignedDate,
          roomNo: parsed.roomNo.trim(),
        },
      });
    });

    revalidatePath("/admin/therapists");
    revalidatePath("/therapist/dashboard");

    return {
      success: true,
      data: {
        therapistId: parsed.therapistId,
        assignedDate: parsed.assignedDate,
        roomNo: parsed.roomNo.trim(),
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message || "Validation failed" };
    }
    console.error("assignTherapistRoomAction error:", error);
    return { success: false, error: "Failed to assign room. Please try again." };
  }
}

/**
 * Get room assignment for a therapist on a specific date.
 */
export async function getTherapistRoomAssignment(
  therapistId: string,
  dateStr: string
): Promise<string | null> {
  try {
    const [assignment] = await db
      .select({ roomNo: therapistRoomAssignments.roomNo })
      .from(therapistRoomAssignments)
      .where(
        and(
          eq(therapistRoomAssignments.therapistId, therapistId),
          eq(therapistRoomAssignments.assignedDate, dateStr)
        )
      )
      .limit(1);

    return assignment?.roomNo || null;
  } catch (err) {
    console.error("getTherapistRoomAssignment error:", err);
    return null;
  }
}
