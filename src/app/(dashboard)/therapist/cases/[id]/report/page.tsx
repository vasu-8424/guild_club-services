import { redirect } from "next/navigation";

interface TherapistReportPageProps {
  params: Promise<{ id: string }>;
}

export default async function TherapistCaseReportPage({
  params,
}: TherapistReportPageProps) {
  const { id } = await params;
  redirect(`/cases/${id}/report`);
}
