import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function AdminBranchesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role === "super_admin") {
    redirect("/super-admin/branches");
  }

  // Admin role does not manage branches
  redirect("/admin/dashboard");
}
