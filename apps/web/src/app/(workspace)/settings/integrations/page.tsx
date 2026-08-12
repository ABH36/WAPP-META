import { IntegrationsView } from "../../../../features/settings/integrations-view";

export default function IntegrationsPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Integrations</h2>
      <IntegrationsView />
    </div>
  );
}
