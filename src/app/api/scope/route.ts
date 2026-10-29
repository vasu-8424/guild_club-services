import { NextResponse } from "next/server";
import { getScope } from "@/lib/scope";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const scope = await getScope();
    return NextResponse.json({
      role: scope.role,
      activeBranchId: scope.activeBranchId,
      activeBranch: scope.activeBranch,
      allowedBranches: scope.allowedBranches,
      hasSelectedBranch: scope.hasSelectedBranch,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Unauthorized" },
      { status: error.statusCode || 401 }
    );
  }
}
