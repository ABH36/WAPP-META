import { CampaignDetail } from "../../../../../features/communication/campaign-detail";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <CampaignDetail campaignId={id} />;
}
