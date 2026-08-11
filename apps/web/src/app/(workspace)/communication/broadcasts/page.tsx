import { BroadcastList } from "../../../../features/communication/broadcast-list";

export default function BroadcastsPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Broadcasts</h2>
      <BroadcastList />
    </div>
  );
}
