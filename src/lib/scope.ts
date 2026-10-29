import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { db } from "@/db";
import { branches, userBranches, type UserRole } from "@/db/schema";
import { getCurrentUser, type CurrentUser } from "@/lib/session";

import { SELECTED_BRANCH_COOKIE } from "@/lib/scope-constants";
export { SELECTED_BRANCH_COOKIE };
export { switchBranchAction } from "@/lib/actions/branch-actions";

export class ScopeError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 404) {
    super(message);
    this.name = "ScopeError";
    this.statusCode = statusCode;
  }
}

export interface ScopeBranch {
  id: string;
  name: string;
  isActive: boolean;
}

export interface Scope {
  user: CurrentUser;
  role: UserRole;
  allowedBranches: ScopeBranch[];
  allowedBranchIds: string[];
  activeBranch: ScopeBranch | null;
  activeBranchId: string | null;
  hasSelectedBranch: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isTherapist: boolean;
  canAccessBranch: (branchId: string | null | undefined) => boolean;
  assertBranchAccess: (branchId: string | null | undefined) => void;
}

/**
 * Access Scope helper enforced across the entire application.
 *
 * Rules:
 * - Super Admin: views data by selecting a branch first. Must be an active branch.
 *   If none is selected, activeBranch is null and pages show the branch picker.
 * - Admin: only assigned branches in user_branches (removed_at IS NULL). If >1,
 *   allows switching only between assigned branches. Tampering with an unauthorized
 *   branch ID throws 403.
 * - Therapist: only their assigned branches. If >1, switcher allows choosing.
 *   Tampering with an unauthorized branch throws 403.
 */
export async function getScope(
  userOrSession?: CurrentUser | null,
  selectedBranchId?: string | null
): Promise<Scope> {
  const user = userOrSession || (await getCurrentUser());
  if (!user) {
    throw new ScopeError("Unauthorized", 401);
  }

  // Check URL / explicit parameter first, then fallback to cookie
  let requestedBranchId = selectedBranchId?.trim() || null;
  if (!requestedBranchId) {
    try {
      const cookieStore = await cookies();
      const cookieVal = cookieStore.get(SELECTED_BRANCH_COOKIE)?.value?.trim();
      if (cookieVal) {
        requestedBranchId = cookieVal;
      }
    } catch {
      // cookies() might fail in some detached contexts; ignore
    }
  }

  let allowedBranches: ScopeBranch[] = [];

  if (user.role === "super_admin") {
    // Super Admin has access to all active branches
    const allActive = await db
      .select({
        id: branches.id,
        name: branches.name,
        isActive: branches.isActive,
      })
      .from(branches)
      .where(eq(branches.isActive, true))
      .orderBy(branches.name);

    allowedBranches = allActive;
  } else {
    // Admin & Therapist: only active branches from user_branches where removed_at IS NULL
    const userAssigned = await db
      .select({
        id: branches.id,
        name: branches.name,
        isActive: branches.isActive,
      })
      .from(userBranches)
      .innerJoin(branches, eq(branches.id, userBranches.branchId))
      .where(
        and(
          eq(userBranches.userId, user.id),
          isNull(userBranches.removedAt),
          eq(branches.isActive, true)
        )
      )
      .orderBy(branches.name);

    allowedBranches = userAssigned;
  }

  const allowedBranchIds = allowedBranches.map((b) => b.id);

  let activeBranch: ScopeBranch | null = null;

  if (user.role === "super_admin") {
    if (requestedBranchId) {
      activeBranch = allowedBranches.find((b) => b.id === requestedBranchId) || null;
    }
  } else {
    // Admin or Therapist
    if (requestedBranchId) {
      const match = allowedBranches.find((b) => b.id === requestedBranchId);
      if (!match) {
        // Explicit URL or cookie tampering with an unauthorized branch
        notFound();
      }
      activeBranch = match;
    } else {
      // Default to first assigned branch if any
      activeBranch = allowedBranches[0] || null;
    }
  }

  const activeBranchId = activeBranch ? activeBranch.id : null;
  const hasSelectedBranch = activeBranch !== null;

  const canAccessBranch = (branchId: string | null | undefined): boolean => {
    if (!branchId) return false;
    // When a branch is selected, operations MUST match the active branch
    if (activeBranchId) {
      return branchId === activeBranchId;
    }
    return allowedBranchIds.includes(branchId);
  };

  const assertBranchAccess = (branchId: string | null | undefined): void => {
    if (!canAccessBranch(branchId)) {
      // Return 404 per security rules: do not reveal that the record exists in another branch
      throw new ScopeError("Not Found", 404);
    }
  };

  return {
    user,
    role: user.role,
    allowedBranches,
    allowedBranchIds,
    activeBranch,
    activeBranchId,
    hasSelectedBranch,
    isSuperAdmin: user.role === "super_admin",
    isAdmin: user.role === "admin",
    isTherapist: user.role === "therapist",
    canAccessBranch,
    assertBranchAccess,
  };
}
