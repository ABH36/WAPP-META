"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PlatformPermission } from "@wapp/shared-types";
import {
  AnnouncementCard,
  Alert,
  Button,
  EmptyState,
  Input,
  Select,
  SkeletonCard,
  Textarea,
} from "@wapp/ui";
import {
  announcementsService,
  type CreateAnnouncementPayload,
} from "../../services/announcements.service";
import { useHasFullPlatformPermission, useHasPlatformPermission } from "../../lib/permissions";
import { ApiError } from "../../lib/api";
import { AnnouncementTargetType } from "../../types/platform";

const EMPTY_FORM: CreateAnnouncementPayload = {
  title: "",
  message: "",
  targetType: AnnouncementTargetType.ALL,
};

const splitIds = (value: string): string[] =>
  value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

/**
 * FRD-001 Volume-8 §4.10 — Global Announcements. `MANAGE_ANNOUNCEMENTS`
 * (FULL creates, VIEW_ONLY reads). Create + List only — no status field,
 * no scheduling, no Publish/Archive routes exist (Architecture Review,
 * 2026-08-12).
 */
export function AnnouncementsView(): React.JSX.Element {
  const queryClient = useQueryClient();
  const canView = useHasPlatformPermission(PlatformPermission.MANAGE_ANNOUNCEMENTS);
  const canCreate = useHasFullPlatformPermission(PlatformPermission.MANAGE_ANNOUNCEMENTS);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState<CreateAnnouncementPayload>(EMPTY_FORM);
  const [planIdsDraft, setPlanIdsDraft] = React.useState("");
  const [workspaceIdsDraft, setWorkspaceIdsDraft] = React.useState("");

  const announcementsQuery = useQuery({
    queryKey: ["platform", "announcements"],
    queryFn: () => announcementsService.list(),
    enabled: canView,
  });

  const handleCreate = async () => {
    if (!form.title.trim() || !form.message.trim()) return;
    setError(null);
    setBusy(true);
    try {
      const payload: CreateAnnouncementPayload = {
        ...form,
        targetPlanIds:
          form.targetType === AnnouncementTargetType.PLANS ? splitIds(planIdsDraft) : undefined,
        targetWorkspaceIds:
          form.targetType === AnnouncementTargetType.WORKSPACES
            ? splitIds(workspaceIdsDraft)
            : undefined,
      };
      await announcementsService.create(payload);
      setForm(EMPTY_FORM);
      setPlanIdsDraft("");
      setWorkspaceIdsDraft("");
      setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: ["platform", "announcements"] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create announcement.");
    } finally {
      setBusy(false);
    }
  };

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Global Announcements.</Alert>;
  }

  const announcements = announcementsQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      {error ? <Alert variant="danger">{error}</Alert> : null}

      {canCreate ? (
        showForm ? (
          <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <Input
              aria-label="Title"
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <Textarea
              aria-label="Message"
              placeholder="Message"
              rows={4}
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            />
            <Select
              aria-label="Target"
              className="w-48"
              value={form.targetType}
              onChange={(e) =>
                setForm((f) => ({ ...f, targetType: e.target.value as AnnouncementTargetType }))
              }
            >
              {Object.values(AnnouncementTargetType).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            {form.targetType === AnnouncementTargetType.PLANS ? (
              <Input
                aria-label="Plan IDs"
                placeholder="Plan IDs, comma-separated"
                value={planIdsDraft}
                onChange={(e) => setPlanIdsDraft(e.target.value)}
              />
            ) : null}
            {form.targetType === AnnouncementTargetType.WORKSPACES ? (
              <Input
                aria-label="Workspace IDs"
                placeholder="Workspace IDs, comma-separated"
                value={workspaceIdsDraft}
                onChange={(e) => setWorkspaceIdsDraft(e.target.value)}
              />
            ) : null}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={busy}
                onClick={() => void handleCreate()}
              >
                Publish
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowForm(false);
                  setForm(EMPTY_FORM);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="w-fit"
            onClick={() => setShowForm(true)}
          >
            New announcement
          </Button>
        )
      ) : null}

      {announcementsQuery.isLoading ? (
        <SkeletonCard />
      ) : announcements.length === 0 ? (
        <EmptyState
          title="No announcements"
          description="Announcements you publish will appear here."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {announcements.map((a) => (
            <AnnouncementCard
              key={a.id}
              title={a.title}
              message={a.message}
              targetType={a.targetType}
              createdAt={a.createdAt}
            />
          ))}
        </div>
      )}
    </div>
  );
}
