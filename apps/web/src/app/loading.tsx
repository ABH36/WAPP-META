import { SkeletonText } from "@wapp/ui";

/** FRD-001 Volume-1 §14 — root-level Suspense fallback for route transitions. Route-level loading.tsx files (added per module) can override this with a more specific skeleton shape. */
export default function RootLoading(): React.JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <SkeletonText lines={3} />
      </div>
    </div>
  );
}
