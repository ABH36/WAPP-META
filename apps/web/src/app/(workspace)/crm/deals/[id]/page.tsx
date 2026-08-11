import { DealDetail } from "../../../../../features/crm/deal-detail";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <DealDetail dealId={id} />;
}
