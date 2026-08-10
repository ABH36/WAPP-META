"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button, EmptyState } from "@wapp/ui";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  React.useEffect(() => {
    console.error("Unhandled route error", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <EmptyState
        icon={<AlertTriangle className="h-10 w-10" aria-hidden />}
        title="Something went wrong"
        description={
          error.digest
            ? `An unexpected error occurred. Reference: ${error.digest}`
            : "An unexpected error occurred. Please try again."
        }
        action={
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
