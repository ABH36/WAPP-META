import { UsageView } from "../../../../features/billing/usage-view";

export default function UsagePage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Usage &amp; Limits</h2>
      <UsageView />
    </div>
  );
}
