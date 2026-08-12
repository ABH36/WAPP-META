import { FeatureFlagsView } from "../../../features/platform/feature-flags-view";

export default function FeatureFlagsPage(): React.JSX.Element {
  return (
    <div>
      <h1 className="text-h1 mb-4 text-neutral-900 dark:text-neutral-50">Feature Flags</h1>
      <FeatureFlagsView />
    </div>
  );
}
