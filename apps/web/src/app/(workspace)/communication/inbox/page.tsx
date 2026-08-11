import { InboxSplitView } from "../../../../features/communication/inbox-split-view";

export default function InboxPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Inbox</h2>
      <InboxSplitView />
    </div>
  );
}
