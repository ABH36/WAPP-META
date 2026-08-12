import { SupportView } from "../../../features/platform/support-view";

export default function SupportPage(): React.JSX.Element {
  return (
    <div>
      <h1 className="text-h1 mb-4 text-neutral-900 dark:text-neutral-50">Customer Support</h1>
      <SupportView />
    </div>
  );
}
