"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PlatformPermission } from "@wapp/shared-types";
import { Alert, Button, Card, GovernanceCard, Input, SkeletonCard, Textarea } from "@wapp/ui";
import { governanceService } from "../../services/governance.service";
import { useHasFullPlatformPermission, useHasPlatformPermission } from "../../lib/permissions";
import { ApiError } from "../../lib/api";
import { GovernancePolicyKey } from "../../types/platform";

const ALL_KEYS = Object.values(GovernancePolicyKey);

/**
 * FRD-001 Volume-8 §4.8 — Governance & Compliance. `MANAGE_PLATFORM_POLICIES`
 * gates both read and write of Policies; `VIEW_COMPLIANCE` gates the
 * separate Compliance snapshot. `GET /platform/policies` only returns
 * keys that have been `PATCH`ed at least once — the remaining
 * `GovernancePolicyKey` values are padded client-side as "Unset" rows
 * (no seeded defaults exist on the backend). No "Violations" concept
 * exists anywhere (Architecture Review, 2026-08-12) — not represented.
 */
export function GovernanceView(): React.JSX.Element {
  const queryClient = useQueryClient();
  const canView = useHasPlatformPermission(PlatformPermission.MANAGE_PLATFORM_POLICIES);
  const canEdit = useHasFullPlatformPermission(PlatformPermission.MANAGE_PLATFORM_POLICIES);
  const canViewCompliance = useHasPlatformPermission(PlatformPermission.VIEW_COMPLIANCE);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [editKey, setEditKey] = React.useState<GovernancePolicyKey | null>(null);
  const [valueDraft, setValueDraft] = React.useState("");
  const [reasonDraft, setReasonDraft] = React.useState("");

  const policiesQuery = useQuery({
    queryKey: ["platform", "policies"],
    queryFn: () => governanceService.listPolicies(),
    enabled: canView,
    // FRD-001 Volume-9 §4.1/§8 — Super-Admin-only, rarely-changed security
    // config; writes still invalidate this key immediately (see
    // handleSave), so a longer window never shows stale post-write data.
    staleTime: 2 * 60_000,
  });

  const complianceQuery = useQuery({
    queryKey: ["platform", "compliance"],
    queryFn: () => governanceService.compliance(),
    enabled: canViewCompliance,
  });

  const startEdit = (
    key: GovernancePolicyKey,
    currentValue: Record<string, unknown> | undefined,
  ) => {
    setEditKey(key);
    setValueDraft(JSON.stringify(currentValue ?? {}, null, 2));
    setReasonDraft("");
    setError(null);
  };

  const handleSave = async () => {
    if (!editKey || reasonDraft.trim().length < 10) {
      setError("A reason of at least 10 characters is required.");
      return;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(valueDraft) as Record<string, unknown>;
    } catch {
      setError("Value must be valid JSON.");
      return;
    }
    setError(null);
    setBusy(editKey);
    try {
      await governanceService.updatePolicy(editKey, parsed, reasonDraft.trim());
      setEditKey(null);
      await queryClient.invalidateQueries({ queryKey: ["platform", "policies"] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update policy.");
    } finally {
      setBusy(null);
    }
  };

  if (!canView && !canViewCompliance) {
    return <Alert variant="info">You don&apos;t have access to Governance & Compliance.</Alert>;
  }

  const policies = policiesQuery.data ?? [];

  return (
    <div className="flex flex-col gap-8">
      {error ? <Alert variant="danger">{error}</Alert> : null}

      {canView ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-h3 text-neutral-900 dark:text-neutral-50">Policies</h2>
          {policiesQuery.isLoading ? (
            <SkeletonCard />
          ) : (
            <div className="flex flex-col gap-3">
              {ALL_KEYS.map((key) => {
                const policy = policies.find((p) => p.key === key);
                return (
                  <div key={key} className="flex flex-col gap-2">
                    <GovernanceCard
                      policyKey={key}
                      isSet={!!policy}
                      version={policy?.version ?? 0}
                      updatedBy={policy?.updatedBy ?? null}
                      updatedAt={policy?.updatedAt ?? null}
                      action={
                        canEdit ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => startEdit(key, policy?.value)}
                          >
                            {policy ? "Edit" : "Set value"}
                          </Button>
                        ) : undefined
                      }
                    />
                    {editKey === key ? (
                      <Card className="ml-4 flex flex-col gap-3">
                        <Textarea
                          aria-label="Policy value (JSON)"
                          rows={6}
                          value={valueDraft}
                          onChange={(e) => setValueDraft(e.target.value)}
                        />
                        <Input
                          aria-label="Reason"
                          placeholder="Reason (min. 10 characters)"
                          value={reasonDraft}
                          onChange={(e) => setReasonDraft(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            loading={busy === key}
                            onClick={() => void handleSave()}
                          >
                            Save
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditKey(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </Card>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {canViewCompliance ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-h3 text-neutral-900 dark:text-neutral-50">Compliance Snapshot</h2>
          {complianceQuery.isLoading || !complianceQuery.data ? (
            <SkeletonCard />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Card className="flex flex-col gap-1">
                <span className="text-caption text-neutral-500 dark:text-neutral-400">
                  Break-Glass Sessions
                </span>
                <span className="text-h3 text-neutral-900 dark:text-neutral-50">
                  {complianceQuery.data.breakGlassSessions.active} active /{" "}
                  {complianceQuery.data.breakGlassSessions.total} total
                </span>
              </Card>
              <Card className="flex flex-col gap-1">
                <span className="text-caption text-neutral-500 dark:text-neutral-400">
                  Platform Logins
                </span>
                <span className="text-h3 text-neutral-900 dark:text-neutral-50">
                  {complianceQuery.data.platformLogins.successful} successful /{" "}
                  {complianceQuery.data.platformLogins.total} total
                </span>
              </Card>
              <Card className="flex flex-col gap-1">
                <span className="text-caption text-neutral-500 dark:text-neutral-400">
                  Failed Login Attempts
                </span>
                <span className="text-h3 text-neutral-900 dark:text-neutral-50">
                  {complianceQuery.data.failedLoginAttempts}
                </span>
              </Card>
              <Card className="flex flex-col gap-1">
                <span className="text-caption text-neutral-500 dark:text-neutral-400">
                  Permission Changes
                </span>
                <span className="text-h3 text-neutral-900 dark:text-neutral-50">
                  {complianceQuery.data.permissionChanges}
                </span>
              </Card>
              <Card className="flex flex-col gap-1">
                <span className="text-caption text-neutral-500 dark:text-neutral-400">
                  Audit Coverage (count)
                </span>
                <span className="text-h3 text-neutral-900 dark:text-neutral-50">
                  {complianceQuery.data.auditCoverage}
                </span>
              </Card>
              <Card className="flex flex-col gap-1">
                <span className="text-caption text-neutral-500 dark:text-neutral-400">
                  Data Retention Policy Coverage
                </span>
                <span className="text-h3 text-neutral-900 dark:text-neutral-50">
                  {complianceQuery.data.dataRetentionStatus.workspacesWithPolicy} /{" "}
                  {complianceQuery.data.dataRetentionStatus.totalWorkspaces}
                </span>
              </Card>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
