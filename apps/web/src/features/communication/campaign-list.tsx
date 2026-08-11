"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Permission } from "@wapp/shared-types";
import { Plus, Trash2 } from "lucide-react";
import { Alert, Button, CampaignCard, EmptyState, Select, SkeletonCard } from "@wapp/ui";
import { campaignService, type CreateCampaignWavePayload } from "../../services/campaign.service";
import { templateService } from "../../services/template.service";
import { whatsappService } from "../../services/whatsapp.service";
import { useHasFullPermission, useHasPermission } from "../../lib/permissions";
import { useKnownContacts } from "./use-known-contacts";
import { ApiError } from "../../lib/api";

const EMPTY_WAVE: CreateCampaignWavePayload = {
  name: "",
  templateId: "",
  bodyParameters: [],
  scheduledAt: "",
};

/**
 * FRD-001 Volume-4 §4.6 — multi-wave orchestration on top of Broadcast.
 * No edit route, no per-Campaign send/pause/resume — only create and
 * cancel. Reuses Broadcast's own permissions (`CREATE_BROADCAST`/
 * `SEND_BROADCAST`); the read itself is gated `VIEW_BROADCASTS` (same
 * `NONE` roles as Broadcasts).
 */
export function CampaignList(): React.JSX.Element {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canView = useHasPermission(Permission.VIEW_BROADCASTS);
  const canCreate = useHasFullPermission(Permission.CREATE_BROADCAST);
  const [showForm, setShowForm] = React.useState(false);
  const [name, setName] = React.useState("");
  const [phoneNumberId, setPhoneNumberId] = React.useState("");
  const [selectedContacts, setSelectedContacts] = React.useState<string[]>([]);
  const [waves, setWaves] = React.useState<CreateCampaignWavePayload[]>([{ ...EMPTY_WAVE }]);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const campaignsQuery = useQuery({
    queryKey: ["communication", "campaigns"],
    queryFn: () => campaignService.list(),
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

  const updateWave = (index: number, patch: Partial<CreateCampaignWavePayload>) => {
    setWaves((prev) => prev.map((wave, i) => (i === index ? { ...wave, ...patch } : wave)));
  };

  const resetForm = () => {
    setName("");
    setPhoneNumberId("");
    setSelectedContacts([]);
    setWaves([{ ...EMPTY_WAVE }]);
    setFormError(null);
  };

  const handleCreate = async () => {
    const invalidWave = waves.some((w) => !w.name.trim() || !w.templateId || !w.scheduledAt);
    if (!name.trim() || !phoneNumberId || selectedContacts.length === 0 || invalidWave) {
      setFormError(
        "Campaign name, phone number, at least one contact, and every wave's name/template/schedule are required.",
      );
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await campaignService.create({
        name: name.trim(),
        phoneNumberId,
        targetContactIds: selectedContacts,
        waves,
      });
      resetForm();
      setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: ["communication", "campaigns"] });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to create campaign.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Campaigns.</Alert>;
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
            New campaign
          </Button>
          {showForm ? (
            <div className="mt-3 flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              {formError ? <Alert variant="danger">{formError}</Alert> : null}
              <input
                aria-label="Campaign name"
                placeholder="Campaign name"
                className="text-body-sm h-9 rounded-md border border-neutral-300 px-3 dark:border-neutral-700 dark:bg-neutral-950"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
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

              <div className="flex flex-col gap-3">
                <p className="text-body-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Waves
                </p>
                {waves.map((wave, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3 dark:border-neutral-800"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-caption text-neutral-500 dark:text-neutral-400">
                        Wave {index + 1}
                      </span>
                      {waves.length > 1 ? (
                        <button
                          type="button"
                          aria-label="Remove wave"
                          onClick={() => setWaves((prev) => prev.filter((_, i) => i !== index))}
                        >
                          <Trash2 className="h-4 w-4 text-neutral-400" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                    <input
                      aria-label={`Wave ${index + 1} name`}
                      placeholder="Wave name"
                      className="text-body-sm h-9 rounded-md border border-neutral-300 px-3 dark:border-neutral-700 dark:bg-neutral-950"
                      value={wave.name}
                      onChange={(event) => updateWave(index, { name: event.target.value })}
                    />
                    <Select
                      aria-label={`Wave ${index + 1} template`}
                      value={wave.templateId}
                      onChange={(event) => updateWave(index, { templateId: event.target.value })}
                    >
                      <option value="">Choose a template…</option>
                      {approvedTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </Select>
                    <input
                      type="datetime-local"
                      aria-label={`Wave ${index + 1} schedule`}
                      className="text-body-sm h-9 rounded-md border border-neutral-300 px-3 dark:border-neutral-700 dark:bg-neutral-950"
                      onChange={(event) =>
                        updateWave(index, {
                          scheduledAt: event.target.value
                            ? new Date(event.target.value).toISOString()
                            : "",
                        })
                      }
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-fit"
                  onClick={() => setWaves((prev) => [...prev, { ...EMPTY_WAVE }])}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Add wave
                </Button>
              </div>

              <Button
                type="button"
                variant="primary"
                loading={submitting}
                className="w-fit"
                onClick={() => void handleCreate()}
              >
                Create campaign
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {campaignsQuery.isLoading ? (
        <SkeletonCard />
      ) : (campaignsQuery.data ?? []).length === 0 ? (
        <EmptyState title="No campaigns" description="Campaigns you create will appear here." />
      ) : (
        <div className="flex flex-col gap-3">
          {(campaignsQuery.data ?? []).map((campaign) => (
            <CampaignCard
              key={campaign.id}
              name={campaign.name}
              status={campaign.status}
              onClick={() => router.push(`/communication/campaigns/${campaign.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
