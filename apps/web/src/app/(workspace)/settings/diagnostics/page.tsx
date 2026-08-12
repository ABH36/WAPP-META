import { DiagnosticsView } from "../../../../features/settings/diagnostics-view";

export default function DiagnosticsPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Diagnostics</h2>
      <DiagnosticsView />
    </div>
  );
}
