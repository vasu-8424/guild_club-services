import { redirect } from "next/navigation";

export default function SuperAdminCasesRedirect() {
  redirect("/admin/cases");
}
