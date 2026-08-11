import { LeadDetail } from "../../../../../features/crm/lead-detail";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <LeadDetail leadId={id} />;
}
