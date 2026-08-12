import { InvoiceDetail } from "../../../../../features/billing/invoice-detail";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <InvoiceDetail invoiceId={id} />;
}
