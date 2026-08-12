"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PlatformPermission, PlatformRole } from "@wapp/shared-types";
import { Alert, Button, EmptyState, Input, PlatformUserCard, Select, SkeletonCard } from "@wapp/ui";
import {
  platformUsersService,
  type CreatePlatformUserPayload,
} from "../../services/platform-users.service";
import { useHasFullPlatformPermission, useHasPlatformPermission } from "../../lib/permissions";
import { ApiError } from "../../lib/api";

const EMPTY_FORM: CreatePlatformUserPayload = {
  fullName: "",
  email: "",
  password: "",
  role: PlatformRole.PLATFORM_SUPPORT_EXECUTIVE,
};

/**
 * FRD-001 Volume-8 §4.3 — Platform Users. `MANAGE_PLATFORM_USERS`
 * (Super-Admin-only). No "Reset Password" action — no backend route
 * exists for it anywhere (Architecture Review, 2026-08-12), filed as
 * Tech Debt.
 */
export function PlatformUsersView(): React.JSX.Element {
  const queryClient = useQueryClient();
  const canView = useHasPlatformPermission(PlatformPermission.MANAGE_PLATFORM_USERS);
  const canEdit = useHasFullPlatformPermission(PlatformPermission.MANAGE_PLATFORM_USERS);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState<CreatePlatformUserPayload>(EMPTY_FORM);

  const usersQuery = useQuery({
    queryKey: ["platform", "users"],
    queryFn: () => platformUsersService.list(),
    enabled: canView,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["platform", "users"] });

  const handleCreate = async () => {
    if (!form.fullName.trim() || !form.email.trim() || !form.password) return;
    setError(null);
    setBusy("create");
    try {
      await platformUsersService.create(form);
      setForm(EMPTY_FORM);
      setShowForm(false);
      await invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create platform user.");
    } finally {
      setBusy(null);
    }
  };

  const handleSetActive = async (id: string, isActive: boolean) => {
    setError(null);
    setBusy(id);
    try {
      await platformUsersService.setActive(id, isActive);
      await invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update user status.");
    } finally {
      setBusy(null);
    }
  };

  const handleRoleChange = async (id: string, role: PlatformRole) => {
    setError(null);
    setBusy(id);
    try {
      await platformUsersService.updateRole(id, role);
      await invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update user role.");
    } finally {
      setBusy(null);
    }
  };

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Platform Users.</Alert>;
  }

  const users = usersQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      {error ? <Alert variant="danger">{error}</Alert> : null}

      {canEdit ? (
        showForm ? (
          <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input
                aria-label="Full name"
                placeholder="Full name"
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              />
              <Input
                aria-label="Email"
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
              <Input
                aria-label="Password"
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
              <Select
                aria-label="Role"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as PlatformRole }))}
              >
                {Object.values(PlatformRole).map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={busy === "create"}
                onClick={() => void handleCreate()}
              >
                Create user
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
            New platform user
          </Button>
        )
      ) : null}

      {usersQuery.isLoading ? (
        <SkeletonCard />
      ) : users.length === 0 ? (
        <EmptyState
          title="No platform users"
          description="Create a platform user to get started."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {users.map((user) => (
            <div key={user.id} className="flex flex-col gap-2">
              <PlatformUserCard
                fullName={user.fullName}
                email={user.email}
                role={user.role}
                isActive={user.isActive}
                lastLoginAt={user.lastLoginAt}
              />
              {canEdit ? (
                <div className="flex flex-wrap items-center gap-2 pl-4">
                  <Select
                    aria-label="Change role"
                    className="text-caption h-8 w-56"
                    value={user.role}
                    disabled={busy === user.id}
                    onChange={(e) => void handleRoleChange(user.id, e.target.value as PlatformRole)}
                  >
                    {Object.values(PlatformRole).map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    variant={user.isActive ? "ghost" : "secondary"}
                    size="sm"
                    loading={busy === user.id}
                    onClick={() => void handleSetActive(user.id, !user.isActive)}
                  >
                    {user.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
