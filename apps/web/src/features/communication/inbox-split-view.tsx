"use client";

import * as React from "react";
import { MessageSquare } from "lucide-react";
import { EmptyState } from "@wapp/ui";
import { InboxList } from "./inbox-list";
import { ConversationView } from "./conversation-view";

/**
 * FRD-001 Volume-4 §13 — "Desktop: Split View — Conversation List +
 * Chat." Below the `lg` breakpoint (tablet/mobile), only the list renders
 * (§13's "Mobile: Full-screen Conversation") — selecting a conversation
 * there navigates to the full `/communication/conversations/:id` route
 * instead (`InboxList`'s default behavior when no `onSelectConversation`
 * is passed), since there's no room for two panels. `/communication/
 * conversations/:id` also stays a real, directly-linkable route on
 * desktop — this split view is a convenience layered on top, not a
 * replacement.
 */
export function InboxSplitView(): React.JSX.Element {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  return (
    <>
      <div className="hidden gap-4 lg:flex lg:h-[calc(100vh-8rem)]">
        <div className="w-96 shrink-0 overflow-y-auto">
          <InboxList
            onSelectConversation={setSelectedId}
            activeConversationId={selectedId ?? undefined}
          />
        </div>
        <div className="flex-1 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
          {selectedId ? (
            <ConversationView conversationId={selectedId} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <EmptyState
                icon={<MessageSquare className="h-8 w-8" aria-hidden />}
                title="Select a conversation"
                description="Choose a conversation from the list to view it here."
              />
            </div>
          )}
        </div>
      </div>

      <div className="lg:hidden">
        <InboxList />
      </div>
    </>
  );
}
