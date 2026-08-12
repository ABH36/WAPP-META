import { AnnouncementsView } from "../../../features/platform/announcements-view";

export default function AnnouncementsPage(): React.JSX.Element {
  return (
    <div>
      <h1 className="text-h1 mb-4 text-neutral-900 dark:text-neutral-50">Global Announcements</h1>
      <AnnouncementsView />
    </div>
  );
}
