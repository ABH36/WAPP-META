import { BroadcastDetail } from "../../../../../features/communication/broadcast-detail";

export default async function BroadcastDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <BroadcastDetail broadcastId={id} />;
}
