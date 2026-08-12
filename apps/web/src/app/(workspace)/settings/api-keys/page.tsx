import { ApiKeysView } from "../../../../features/settings/api-keys-view";

export default function ApiKeysPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">API Keys</h2>
      <ApiKeysView />
    </div>
  );
}
