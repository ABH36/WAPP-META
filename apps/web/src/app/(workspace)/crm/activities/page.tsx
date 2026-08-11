import { ActivityList } from "../../../../features/crm/activity-list";

export default function ActivitiesPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Activities</h2>
      <ActivityList />
    </div>
  );
}
