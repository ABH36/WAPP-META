import { LoginHistoryList } from "../../../../features/auth/login-history-list";

export default function ProfileLoginHistoryPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Login history</h2>
      <LoginHistoryList />
    </div>
  );
}
