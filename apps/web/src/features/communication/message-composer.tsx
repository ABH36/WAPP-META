"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Permission } from "@wapp/shared-types";
import { Send } from "lucide-react";
import { Alert, Button, Select, Textarea } from "@wapp/ui";
import { conversationService } from "../../services/conversation.service";
import { templateService } from "../../services/template.service";
import { useHasPermission } from "../../lib/permissions";
import { countBodyPlaceholders } from "../../lib/template-placeholders";
import { ApiError } from "../../lib/api";

const QUICK_EMOJI = ["😀", "👍", "🙏", "❤️", "😊", "✅"];

interface MessageComposerProps {
  conversationId: string;
}

/**
 * FRD-001 Volume-4 §4.4 — Text, Templates, Emoji (Attachments omitted —
 * no backend support, see docs/TECH-DEBT.md). "Quick Replies" is a
 * shortcut into this same Template picker, not a separate backend
 * concept (Architecture Review, 2026-08-11). The 24-hour customer-service
 * window is handled reactively, not proactively: `ConversationSummary`
 * doesn't expose `lastCustomerMessageAt` (only the backend's internal
 * compliance check has it), so there's no field to pre-check client-side
 * — see docs/TECH-DEBT.md. A free-text send outside the window fails with
 * a 403 (`OutsideCustomerServiceWindowException`, always this specific
 * message since `REPLY_CONVERSATIONS` is already required to reach this
 * component at all); the Composer catches it and offers the Template
 * picker as the way forward, per the backend's own documented intent.
 * Template mode additionally requires `VIEW_TEMPLATES` — a separate
 * permission domain from `REPLY_CONVERSATIONS`, `NONE` for
 * `SALES_EXECUTIVE`/`SUPPORT_MANAGER`/`SUPPORT_EXECUTIVE` even though
 * those roles can otherwise use this Composer; the Template tab is
 * hidden entirely for them rather than 403ing on the templates fetch.
 */
export function MessageComposer({ conversationId }: MessageComposerProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const canViewTemplates = useHasPermission(Permission.VIEW_TEMPLATES);
  const [mode, setMode] = React.useState<"text" | "template">("text");
  const [text, setText] = React.useState("");
  const [templateId, setTemplateId] = React.useState("");
  const [bodyParameters, setBodyParameters] = React.useState<string[]>([]);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [outsideWindow, setOutsideWindow] = React.useState(false);

  const templatesQuery = useQuery({
    queryKey: ["communication", "templates"],
    queryFn: () => templateService.list(),
    enabled: mode === "template" && canViewTemplates,
  });
  const approvedTemplates = (templatesQuery.data ?? []).filter((t) => t.status === "APPROVED");
  const selectedTemplate = approvedTemplates.find((t) => t.id === templateId);
  const bodyComponent = selectedTemplate?.components.find((c) => c.type === "BODY");
  const placeholderCount = countBodyPlaceholders(bodyComponent?.text);

  React.useEffect(() => {
    setBodyParameters(Array.from({ length: placeholderCount }, () => ""));
  }, [templateId, placeholderCount]);

  const invalidateMessages = () =>
    queryClient.invalidateQueries({ queryKey: ["communication", "conversation", conversationId] });

  const sendText = async () => {
    if (!text.trim()) return;
    setError(null);
    setOutsideWindow(false);
    setSending(true);
    try {
      await conversationService.reply(conversationId, text.trim());
      setText("");
      await invalidateMessages();
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 403) {
        setOutsideWindow(true);
      } else {
        setError(err instanceof ApiError ? err.message : "Failed to send message.");
      }
    } finally {
      setSending(false);
    }
  };

  const sendTemplate = async () => {
    if (!templateId) return;
    setError(null);
    setSending(true);
    try {
      await conversationService.replyWithTemplate(conversationId, templateId, bodyParameters);
      setTemplateId("");
      setMode("text");
      await invalidateMessages();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send template message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 border-t border-neutral-200 p-3 dark:border-neutral-800">
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {outsideWindow ? (
        <Alert variant="warning">
          This conversation is outside the 24-hour customer service window — only an approved
          template message can be sent.{" "}
          {canViewTemplates ? (
            <button
              type="button"
              className="text-brand-700 dark:text-brand-300 font-medium underline"
              onClick={() => {
                setOutsideWindow(false);
                setMode("template");
              }}
            >
              Send a template instead
            </button>
          ) : null}
        </Alert>
      ) : null}

      {canViewTemplates ? (
        <div className="text-caption flex gap-2">
          <button
            type="button"
            className={
              mode === "text"
                ? "text-brand-700 dark:text-brand-300 font-medium"
                : "text-neutral-500 dark:text-neutral-400"
            }
            onClick={() => setMode("text")}
          >
            Text
          </button>
          <span className="text-neutral-300 dark:text-neutral-700">·</span>
          <button
            type="button"
            className={
              mode === "template"
                ? "text-brand-700 dark:text-brand-300 font-medium"
                : "text-neutral-500 dark:text-neutral-400"
            }
            onClick={() => setMode("template")}
          >
            Template
          </button>
        </div>
      ) : null}

      {mode === "text" || !canViewTemplates ? (
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <div className="flex gap-1">
              {QUICK_EMOJI.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-label={`Insert ${emoji}`}
                  className="text-body-lg hover:opacity-70"
                  onClick={() => setText((t) => t + emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <Textarea
            aria-label="Message text"
            className="min-h-10 flex-1"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Type a message"
          />
          <Button
            type="button"
            variant="primary"
            loading={sending}
            disabled={!text.trim()}
            onClick={() => void sendText()}
          >
            <Send className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Select
            aria-label="Choose a template"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
          >
            <option value="">Choose a template…</option>
            {approvedTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </Select>
          {bodyParameters.map((value, index) => (
            <input
              key={index}
              aria-label={`Parameter ${index + 1}`}
              placeholder={`{{${index + 1}}}`}
              className="text-body-sm h-9 rounded-md border border-neutral-300 px-3 dark:border-neutral-700 dark:bg-neutral-950"
              value={value}
              onChange={(event) =>
                setBodyParameters((params) =>
                  params.map((p, i) => (i === index ? event.target.value : p)),
                )
              }
            />
          ))}
          <Button
            type="button"
            variant="primary"
            loading={sending}
            disabled={!templateId}
            className="w-fit"
            onClick={() => void sendTemplate()}
          >
            <Send className="h-4 w-4" aria-hidden />
            Send template
          </Button>
        </div>
      )}
    </div>
  );
}
