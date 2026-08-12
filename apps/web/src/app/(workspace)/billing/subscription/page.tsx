import { SubscriptionView } from "../../../../features/billing/subscription-view";

export default function SubscriptionPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Subscription</h2>
      <SubscriptionView />
    </div>
  );
}
