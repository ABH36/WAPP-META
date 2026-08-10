import { SkeletonText } from "@wapp/ui";

export default function RootLoading(): React.JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <SkeletonText lines={3} />
      </div>
    </div>
  );
}
