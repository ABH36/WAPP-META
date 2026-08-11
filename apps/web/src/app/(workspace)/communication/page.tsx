import { CommunicationDashboard } from "../../../features/communication/communication-dashboard";

export default function CommunicationDashboardPage(): React.JSX.Element {
  return (
    <div>
      <h1 className="text-h1 mb-4 text-neutral-900 dark:text-neutral-50">Communication</h1>
      <CommunicationDashboard />
    </div>
  );
}
