import { BreakGlassView } from "../../../features/platform/break-glass-view";

export default function BreakGlassPage(): React.JSX.Element {
  return (
    <div>
      <h1 className="text-h1 mb-4 text-neutral-900 dark:text-neutral-50">Break-Glass Access</h1>
      <BreakGlassView />
    </div>
  );
}
