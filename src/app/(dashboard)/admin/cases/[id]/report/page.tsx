import { redirect } from "next/navigation";

interface AdminReportPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminCaseReportPage({
  params,
}: AdminReportPageProps) {
  const { id } = await params;
  redirect(`/cases/${id}/report`);
}
