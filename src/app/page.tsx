import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getRoleDashboardPath } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  redirect(getRoleDashboardPath(user.role));
}
