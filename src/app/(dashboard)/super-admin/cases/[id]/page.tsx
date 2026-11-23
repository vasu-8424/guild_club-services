import { redirect } from "next/navigation";

export default async function SuperAdminCaseRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/cases/${id}`);
}
