import { CustomerDetail } from "../../../../../features/crm/customer-detail";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <CustomerDetail customerId={id} />;
}
