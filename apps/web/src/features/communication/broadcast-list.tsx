"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Permission } from "@wapp/shared-types";
import { Plus } from "lucide-react";
import { Alert, BroadcastCard, Button, EmptyState, Select, SkeletonCard } from "@wapp/ui";
import { broadcastService } from "../../services/broadcast.service";
import { templateService } from "../../services/template.service";
import { whatsappService } from "../../services/whatsapp.service";
import { useHasFullPermission, useHasPermission } from "../../lib/permissions";
import { useKnownContacts } from "./use-known-contacts";
import { ApiError } from "../../lib/api";

/**
 * FRD-001 Volume-4 §4.6 — one-time bulk template sends, a resource
 * distinct from Campaign (Architecture Review, 2026-08-11). No edit route
 * exists — create + status-transition actions only. Create is gated
 * `CREATE_BROADCAST` at `FULL` specifically (VIEW_ONLY roles never see
 * the form). The read itself is gated `VIEW_BROADCASTS`, `NONE` for
 * `SALES_EXECUTIVE`/`SUPPORT_MANAGER`/`SUPPORT_EXECUTIVE` — those roles
 * see an access-restricted message instead of a 403 from the list call.
 */
export function BroadcastList(): React.JSX.Element {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canView = useHasPermission(Permission.VIEW_BROADCASTS);
  const canCreate = useHasFullPermission(Permission.CREATE_BROADCAST);
  const [showForm, setShowForm] = React.useState(false);
  const [name, setName] = React.useState("");
  const [templateId, setTemplateId] = React.useState("");
  const [phoneNumberId, setPhoneNumberId] = React.useState("");
  const [selectedContacts, setSelectedContacts] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const broadcastsQuery = useQuery({
    queryKey: ["communication", "broadcasts"],
    queryFn: () => broadcastService.list(),
    enabled: canView,
  });
  const templatesQuery = useQuery({
    queryKey: ["communication", "templates"],
    queryFn: () => templateService.list(),
    enabled: showForm,
  });
  const phoneNumbersQuery = useQuery({
    queryKey: ["communication", "phone-numbers"],
    queryFn: () => whatsappService.listPhoneNumbers(),
    enabled: showForm,
  });
  const { contacts, isLoading: contactsLoading } = useKnownContacts();
  const approvedTemplates = (templatesQuery.data ?? []).filter((t) => t.status === "APPROVED");

  const resetForm = () => {
    setName("");
    setTemplateId("");
    setPhoneNumberId("");
    setSelectedContacts([]);
    setFormError(null);
  };

  const handleCreate = async () => {
    if (!name.trim() || !templateId || !phoneNumberId || selectedContacts.length === 0) {
      setFormError("Name, template, phone number, and at least one contact are required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await broadcastService.create({
        name: name.trim(),
        templateId,
        phoneNumberId,
        targetContactIds: selectedContacts,
        bodyParameters: [],
      });
      resetForm();
      setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: ["communication", "broadcasts"] });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to create broadcast.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Broadcasts.</Alert>;
  }

  return (
    <div className="flex flex-col gap-4">
      {canCreate ? (
        <div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-fit"
            onClick={() => setShowForm((v) => !v)}
          >
            <Plus className="h-4 w-4" aria-hidden />
            New broadcast
          </Button>
          {showForm ? (
            <div className="mt-3 flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              {formError ? <Alert variant="danger">{formError}</Alert> : null}
              <input
                aria-label="Broadcast name"
                placeholder="Broadcast name"
                className="text-body-sm h-9 rounded-md border border-neutral-300 px-3 dark:border-neutral-700 dark:bg-neutral-950"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <Select
                aria-label="Template"
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
              <Select
                aria-label="Phone number"
                value={phoneNumberId}
                onChange={(event) => setPhoneNumberId(event.target.value)}
              >
                <option value="">Choose a phone number…</option>
                {(phoneNumbersQuery.data ?? []).map((phone) => (
                  <option key={phone.id} value={phone.id}>
                    {phone.displayPhoneNumber}
                  </option>
                ))}
              </Select>
              <div>
                <p className="text-body-sm mb-1 font-medium text-neutral-700 dark:text-neutral-300">
                  Target contacts (from recently active conversations)
                </p>
                {contactsLoading ? (
                  <SkeletonCard />
                ) : contacts.length === 0 ? (
                  <p className="text-body-sm text-neutral-500 dark:text-neutral-400">
                    No known contacts yet — contacts appear here once they message you.
                  </p>
                ) : (
                  <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md border border-neutral-200 p-2 dark:border-neutral-800">
                    {contacts.map((contact) => (
                      <label key={contact.id} className="text-body-sm flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedContacts.includes(contact.id)}
                          onChange={(event) =>
                            setSelectedContacts((prev) =>
                              event.target.checked
                                ? [...prev, contact.id]
                                : prev.filter((id) => id !== contact.id),
                            )
                          }
                        />
                        {contact.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="primary"
                loading={submitting}
                className="w-fit"
                onClick={() => void handleCreate()}
              >
                Create broadcast
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {broadcastsQuery.isLoading ? (
        <SkeletonCard />
      ) : (broadcastsQuery.data ?? []).length === 0 ? (
        <EmptyState title="No broadcasts" description="Broadcasts you create will appear here." />
      ) : (
        <div className="flex flex-col gap-3">
          {(broadcastsQuery.data ?? []).map((broadcast) => (
            <BroadcastCard
              key={broadcast.id}
              name={broadcast.name}
              status={broadcast.status}
              scheduledAt={broadcast.scheduledAt}
              onClick={() => router.push(`/communication/broadcasts/${broadcast.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
