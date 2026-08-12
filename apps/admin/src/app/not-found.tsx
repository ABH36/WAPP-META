import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { EmptyState } from "@wapp/ui";

export default function NotFound(): React.JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <EmptyState
        icon={<FileQuestion className="h-10 w-10" aria-hidden />}
        title="Page not found"
        description="The page you're looking for doesn't exist or has moved."
        action={
          <Link
            href="/"
            className="bg-brand-600 text-body duration-micro hover:bg-brand-700 inline-flex h-9 items-center justify-center rounded-md px-4 font-medium text-white transition-colors"
          >
            Back to dashboard
          </Link>
        }
      />
    </main>
  );
}
