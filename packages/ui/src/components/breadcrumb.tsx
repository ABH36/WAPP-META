import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../lib/cn";

/** DS-001 §4 — Breadcrumbs, shadcn `breadcrumb` base. Used for CRM detail drill-down. */
export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items, className, ...props }: BreadcrumbProps): React.JSX.Element {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("text-body-sm flex items-center gap-1", className)}
      {...props}
    >
      <ol className="flex items-center gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <a
                  href={item.href}
                  className="duration-micro text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-50"
                >
                  {item.label}
                </a>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={
                    isLast
                      ? "font-medium text-neutral-900 dark:text-neutral-50"
                      : "text-neutral-500 dark:text-neutral-400"
                  }
                >
                  {item.label}
                </span>
              )}
              {!isLast ? (
                <ChevronRight className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
