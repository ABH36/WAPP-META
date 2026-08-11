import { ConversationView } from "../../../../../features/communication/conversation-view";

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <ConversationView conversationId={id} />;
}
