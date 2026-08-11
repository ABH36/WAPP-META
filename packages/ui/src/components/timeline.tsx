import * as React from "react";
import { cn } from "../lib/cn";

/** FRD-001 Volume-5 §4.8/§7 — "Timeline style" display for Notes/Activity feeds on Customer/Deal profiles. Pure layout — connecting line + dot per item; content is whatever the caller passes as `children`. */
export function Timeline({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div className={cn("flex flex-col", className)} {...props}>
      {children}
    </div>
  );
}

export interface TimelineItemProps extends React.HTMLAttributes<HTMLDivElement> {
  last?: boolean;
}

export const TimelineItem = React.forwardRef<HTMLDivElement, TimelineItemProps>(
  ({ className, last, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("relative flex gap-3 pb-6", className)} {...props}>
        <div className="flex flex-col items-center">
          <span className="bg-brand-500 mt-1 h-2.5 w-2.5 shrink-0 rounded-full" />
          {!last ? <span className="mt-1 w-px flex-1 bg-neutral-200 dark:bg-neutral-800" /> : null}
        </div>
        <div className="flex-1 pb-2">{children}</div>
      </div>
    );
  },
);
TimelineItem.displayName = "TimelineItem";
