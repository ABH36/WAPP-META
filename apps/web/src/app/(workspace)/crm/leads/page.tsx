import { LeadList } from "../../../../features/crm/lead-list";

export default function LeadsPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Leads</h2>
      <LeadList />
    </div>
  );
}
