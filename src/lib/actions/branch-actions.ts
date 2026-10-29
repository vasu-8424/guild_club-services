"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { branches, type Branch } from "@/db/schema";
import { requireRole } from "@/lib/session";

export async function getBranchesAction(
  includeInactive: boolean = false
): Promise<{ success: boolean; branches: Branch[]; error?: string }> {
  try {
    let query = db.select().from(branches);
    if (!includeInactive) {
      // @ts-expect-error Drizzle conditional query
      query = query.where(eq(branches.isActive, true));
    }
    const list = await query.orderBy(asc(branches.name));
    return { success: true, branches: list };
  } catch (error) {
    console.error("Failed to fetch branches:", error);
    return { success: false, branches: [], error: "Failed to load branches." };
  }
}

export async function createBranchAction(
  name: string
): Promise<{ success: boolean; branch?: Branch; error?: string }> {
  await requireRole("admin", "super_admin");

  const trimmed = name?.trim();
  if (!trimmed || trimmed.length < 2) {
    return { success: false, error: "Branch name must be at least 2 characters." };
  }

  try {
    const [newBranch] = await db
      .insert(branches)
      .values({
        name: trimmed,
        isActive: true,
      })
      .returning();

    revalidatePath("/admin/branches");
    return { success: true, branch: newBranch };
  } catch (error) {
    console.error("Failed to create branch:", error);
    return { success: false, error: "Failed to create branch. Name may be duplicate." };
  }
}

export async function renameBranchAction(
  id: string,
  newName: string
): Promise<{ success: boolean; error?: string }> {
  await requireRole("admin", "super_admin");

  const trimmed = newName?.trim();
  if (!trimmed || trimmed.length < 2) {
    return { success: false, error: "Branch name must be at least 2 characters." };
  }

  try {
    await db
      .update(branches)
      .set({ name: trimmed })
      .where(eq(branches.id, id));

    revalidatePath("/admin/branches");
    return { success: true };
  } catch (error) {
    console.error("Failed to rename branch:", error);
    return { success: false, error: "Failed to rename branch." };
  }
}

export async function toggleBranchStatusAction(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  await requireRole("admin", "super_admin");

  try {
    await db
      .update(branches)
      .set({ isActive })
      .where(eq(branches.id, id));

    revalidatePath("/admin/branches");
    return { success: true };
  } catch (error) {
    console.error("Failed to update branch status:", error);
    return { success: false, error: "Failed to update branch status." };
  }
}

/**
 * Server Action for switching the user's active branch.
 */
export async function switchBranchAction(
  branchId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { cookies } = await import("next/headers");
    const { userBranches } = await import("@/db/schema");
    const { isNull, and } = await import("drizzle-orm");
    const { getCurrentUser } = await import("@/lib/session");
    const { SELECTED_BRANCH_COOKIE } = await import("@/lib/scope-constants");

    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    if (user.role !== "super_admin") {
      const [assignment] = await db
        .select()
        .from(userBranches)
        .innerJoin(branches, eq(branches.id, userBranches.branchId))
        .where(
          and(
            eq(userBranches.userId, user.id),
            eq(userBranches.branchId, branchId),
            isNull(userBranches.removedAt),
            eq(branches.isActive, true)
          )
        )
        .limit(1);

      if (!assignment) {
        return { success: false, error: "You are not assigned to this branch." };
      }
    }

    const cookieStore = await cookies();
    cookieStore.set(SELECTED_BRANCH_COOKIE, branchId, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to switch branch." };
  }
}
