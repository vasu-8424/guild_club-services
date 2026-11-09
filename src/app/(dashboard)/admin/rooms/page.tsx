import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function AdminRoomsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role === "super_admin") {
    redirect("/super-admin/rooms");
  }

  // Admin role does not manage rooms
  redirect("/admin/dashboard");
}
