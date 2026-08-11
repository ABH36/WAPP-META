import { BusinessHoursEditor } from "../../../../features/workspace/business-hours-editor";

export default function WorkspaceBusinessHoursPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Business hours</h2>
      <BusinessHoursEditor />
    </div>
  );
}
