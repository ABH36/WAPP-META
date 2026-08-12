import { InvoiceList } from "../../../../features/billing/invoice-list";

export default function InvoicesPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Invoices</h2>
      <InvoiceList />
    </div>
  );
}
