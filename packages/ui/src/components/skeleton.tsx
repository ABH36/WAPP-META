import * as React from "react";
import { cn } from "../lib/cn";

/** DS-001 §4/§8 — Skeleton Loader, shadcn `skeleton` base. "Matches the shape of the content it replaces" — used raw or composed (see SkeletonText/SkeletonCard below). */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800", className)}
      {...props}
    />
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

export function SkeletonCard(): React.JSX.Element {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <Skeleton className="mb-3 h-5 w-1/3" />
      <SkeletonText lines={2} />
    </div>
  );
}
