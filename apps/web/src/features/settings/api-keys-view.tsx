"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Permission } from "@wapp/shared-types";
import { Alert, ApiKeyCard, Button, EmptyState, Input, Select, SkeletonCard } from "@wapp/ui";
import { apiKeysService } from "../../services/api-keys.service";
import { useHasFullPermission, useHasPermission } from "../../lib/permissions";
import { ApiError } from "../../lib/api";
import { ApiKeyScope, type GeneratedApiKey } from "../../types/settings";

/**
 * FRD-001 Volume-7 §4.8 — `EDIT_WORKSPACE`. `generatedKey`'s `rawKey` is
 * rendered exactly once, in a dismissible confirmation panel — never
 * re-fetchable, never persisted to any store beyond this component's own
 * local state (BR-004: frontend never stores API secrets).
 */
export function ApiKeysView(): React.JSX.Element {
  const queryClient = useQueryClient();
  const canView = useHasPermission(Permission.EDIT_WORKSPACE);
  const canEdit = useHasFullPermission(Permission.EDIT_WORKSPACE);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [scope, setScope] = React.useState<ApiKeyScope>(ApiKeyScope.READ);
  const [generatedKey, setGeneratedKey] = React.useState<GeneratedApiKey | null>(null);

  const keysQuery = useQuery({
    queryKey: ["settings", "api-keys"],
    queryFn: () => apiKeysService.list(),
    enabled: canView,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["settings", "api-keys"] });

  const handleCreate = async () => {
    if (!name.trim()) return;
    setError(null);
    setBusy("create");
    try {
      const created = await apiKeysService.create({ name: name.trim(), scope });
      setGeneratedKey(created);
      setName("");
      await invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create API key.");
    } finally {
      setBusy(null);
    }
  };

  const handleRevoke = async (id: string) => {
    setError(null);
    setBusy(`revoke-${id}`);
    try {
      await apiKeysService.revoke(id);
      await invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to revoke API key.");
    } finally {
      setBusy(null);
    }
  };

  const handleRotate = async (id: string) => {
    setError(null);
    setBusy(`rotate-${id}`);
    try {
      const rotated = await apiKeysService.rotate(id);
      setGeneratedKey(rotated);
      await invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to rotate API key.");
    } finally {
      setBusy(null);
    }
  };

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to API Keys.</Alert>;
  }

  const keys = keysQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      {error ? <Alert variant="danger">{error}</Alert> : null}

      {generatedKey ? (
        <Alert variant="warning">
          <div className="flex flex-col gap-2">
            <p className="text-body-sm font-medium">
              Copy this key now — it will never be shown again.
            </p>
            <code className="text-body-sm break-all rounded bg-neutral-900 p-2 text-neutral-50">
              {generatedKey.rawKey}
            </code>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-fit"
              onClick={() => setGeneratedKey(null)}
            >
              I&apos;ve copied it
            </Button>
          </div>
        </Alert>
      ) : null}

      {canEdit ? (
        <div className="flex flex-wrap items-end gap-2">
          <Input
            aria-label="Key name"
            placeholder="Key name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Select
            aria-label="Scope"
            value={scope}
            onChange={(e) => setScope(e.target.value as ApiKeyScope)}
          >
            <option value={ApiKeyScope.READ}>Read</option>
            <option value={ApiKeyScope.WRITE}>Write</option>
          </Select>
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={busy === "create"}
            onClick={() => void handleCreate()}
          >
            Create Key
          </Button>
        </div>
      ) : null}

      {keysQuery.isLoading ? (
        <SkeletonCard />
      ) : keys.length === 0 ? (
        <EmptyState
          title="No API keys"
          description="Create a key to authenticate external integrations."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {keys.map((key) => (
            <ApiKeyCard
              key={key.id}
              name={key.name}
              prefix={key.prefix}
              scope={key.scope}
              status={key.status}
              lastUsedAt={key.lastUsedAt}
              expiresAt={key.expiresAt}
              onRevoke={canEdit ? () => void handleRevoke(key.id) : undefined}
              onRotate={canEdit ? () => void handleRotate(key.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
