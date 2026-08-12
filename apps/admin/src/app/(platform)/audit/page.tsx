import { AuditView } from "../../../features/platform/audit-view";

export default function AuditPage(): React.JSX.Element {
  return (
    <div>
      <h1 className="text-h1 mb-4 text-neutral-900 dark:text-neutral-50">Global Audit Center</h1>
      <AuditView />
    </div>
  );
}
