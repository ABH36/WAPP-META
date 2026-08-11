import { DealList } from "../../../../features/crm/deal-list";

export default function DealsPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Deals</h2>
      <DealList />
    </div>
  );
}
