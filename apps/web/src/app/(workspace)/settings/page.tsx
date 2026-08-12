import { SettingsHome } from "../../../features/settings/settings-home";

export default function SettingsPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Settings</h2>
      <SettingsHome />
    </div>
  );
}
