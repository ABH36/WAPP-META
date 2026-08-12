import { MaintenanceView } from "../../../features/platform/maintenance-view";

export default function MaintenancePage(): React.JSX.Element {
  return (
    <div>
      <h1 className="text-h1 mb-4 text-neutral-900 dark:text-neutral-50">Maintenance Mode</h1>
      <MaintenanceView />
    </div>
  );
}
