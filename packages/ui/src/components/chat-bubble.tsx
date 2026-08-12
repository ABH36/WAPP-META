import * as React from "react";
import { Check, CheckCheck, Clock, X } from "lucide-react";
import { cn } from "../lib/cn";

const STATUS_ICON: Record<string, React.ReactNode> = {
  SENDING: <Clock className="h-3 w-3" aria-hidden />,
  QUEUED: <Clock className="h-3 w-3" aria-hidden />,
  SENT: <Check className="h-3 w-3" aria-hidden />,
  DELIVERED: <CheckCheck className="h-3 w-3" aria-hidden />,
  READ: <CheckCheck className="text-brand-500 h-3 w-3" aria-hidden />,
  FAILED: <X className="text-danger-500 h-3 w-3" aria-hidden />,
};

/** FRD-001 Volume-4 §4.3/§7 — one message in the Conversation timeline. `status` is only rendered for outbound messages (inbound messages have no "read by us" concept to show); a `status` of `"SENDING"` is the one purely client-side value (an optimistic state while the send request is in flight — the backend never returns it, sends are synchronous). */
export interface ChatBubbleProps extends React.HTMLAttributes<HTMLDivElement> {
  direction: "INBOUND" | "OUTBOUND";
  text: string | null;
  occurredAt: string;
  status?: string;
}

export const ChatBubble = React.forwardRef<HTMLDivElement, ChatBubbleProps>(
  ({ className, direction, text, occurredAt, status, ...props }, ref) => {
    const outbound = direction === "OUTBOUND";
    return (
      <div
        ref={ref}
        className={cn("flex flex-col gap-1", outbound ? "items-end" : "items-start", className)}
        {...props}
      >
        <div
          className={cn(
            "text-body-sm max-w-[75%] rounded-lg px-3 py-2",
            outbound
              ? "bg-brand-600 text-white"
              : "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50",
          )}
        >
          {text ?? <span className="italic opacity-70">Unsupported message content</span>}
        </div>
        <div className="text-caption flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
          <span>
            {new Date(occurredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          {outbound && status ? STATUS_ICON[status] : null}
        </div>
      </div>
    );
  },
);
ChatBubble.displayName = "ChatBubble";
