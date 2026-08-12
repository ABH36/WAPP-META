import { PreferencesView } from "../../../../features/settings/preferences-view";

export default function PreferencesPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Preferences</h2>
      <PreferencesView />
    </div>
  );
}
