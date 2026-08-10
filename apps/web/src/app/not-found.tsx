import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { EmptyState } from "@wapp/ui";

/** FRD-001 Volume-1 §8/§14 — root 404 page. Plain Link styled to match Button's primary variant — `Button` itself always renders a `<button>` (no `asChild`/Slot support), so it can't wrap an `<a>` directly. */
export default function NotFound(): React.JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <EmptyState
        icon={<FileQuestion className="h-10 w-10" aria-hidden />}
        title="Page not found"
        description="The page you're looking for doesn't exist or has moved."
        action={
          <Link
            href="/"
            className="bg-brand-500 text-body duration-micro hover:bg-brand-600 inline-flex h-9 items-center justify-center rounded-md px-4 font-medium text-white transition-colors"
          >
            Back to home
          </Link>
        }
      />
    </div>
  );
}
