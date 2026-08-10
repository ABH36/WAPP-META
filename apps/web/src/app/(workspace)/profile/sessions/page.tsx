import { SessionsList } from "../../../../features/auth/sessions-list";

export default function ProfileSessionsPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Active sessions</h2>
      <SessionsList />
    </div>
  );
}
