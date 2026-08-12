import { PlatformUsersView } from "../../../features/platform/platform-users-view";

export default function PlatformUsersPage(): React.JSX.Element {
  return (
    <div>
      <h1 className="text-h1 mb-4 text-neutral-900 dark:text-neutral-50">Platform Users</h1>
      <PlatformUsersView />
    </div>
  );
}
