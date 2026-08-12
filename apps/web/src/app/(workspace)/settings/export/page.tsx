import { ExportView } from "../../../../features/settings/export-view";

export default function ExportPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Data Export</h2>
      <ExportView />
    </div>
  );
}
