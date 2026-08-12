import { WebhooksView } from "../../../../features/settings/webhooks-view";

export default function WebhooksPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Webhooks</h2>
      <WebhooksView />
    </div>
  );
}
