import { AutomationSettingsForm } from "../../../../features/communication/automation-settings-form";

export default function AutomationPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Automation settings</h2>
      <AutomationSettingsForm />
    </div>
  );
}
