import { AuditLogView } from "../../../../features/settings/audit-log-view";

export default function AuditPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Audit Logs</h2>
      <AuditLogView />
    </div>
  );
}
