import { BillingOperationsView } from "../../../features/platform/billing-operations-view";

export default function BillingOperationsPage(): React.JSX.Element {
  return (
    <div>
      <h1 className="text-h1 mb-4 text-neutral-900 dark:text-neutral-50">Billing Operations</h1>
      <BillingOperationsView />
    </div>
  );
}
