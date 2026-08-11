import { NotificationSettingsForm } from "../../../../features/workspace/notification-settings-form";

export default function WorkspaceNotificationsPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Notification settings</h2>
      <NotificationSettingsForm />
    </div>
  );
}
