import * as React from "react";
import { User } from "lucide-react";
import { Card } from "./card";
import { cn } from "../lib/cn";

/**
 * FRD-001 Volume-4 §4.3/§4.5/§7 — read-only contact info panel inside
 * Conversation View. Architecture Review, 2026-08-11: Contacts is not a
 * standalone module (no Contact CRUD routes exist) — this is the entire
 * surface Contact information gets this volume, using only the fields
 * already embedded in `ConversationSummary`.
 */
export interface ContactCardProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string | null;
  phoneNumber: string | null;
}

export const ContactCard = React.forwardRef<HTMLDivElement, ContactCardProps>(
  ({ className, name, phoneNumber, ...props }, ref) => {
    return (
      <Card ref={ref} className={cn("flex items-center gap-3", className)} {...props}>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
          <User className="h-5 w-5 text-neutral-500 dark:text-neutral-400" aria-hidden />
        </div>
        <div>
          <div className="text-body font-medium text-neutral-900 dark:text-neutral-50">
            {name ?? "Unknown contact"}
          </div>
          <div className="text-caption text-neutral-500 dark:text-neutral-400">
            {phoneNumber ?? "—"}
          </div>
        </div>
      </Card>
    );
  },
);
ContactCard.displayName = "ContactCard";
