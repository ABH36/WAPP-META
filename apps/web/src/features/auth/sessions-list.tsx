"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button, EmptyState, SessionCard, SkeletonCard } from "@wapp/ui";
import { authService } from "../../services/auth.service";
import { parseUserAgent } from "../../lib/user-agent";
import { ApiError } from "../../lib/api";

/** FRD-001 Volume-2 §4.5 — Active Sessions. No "current session" marking (Architecture Review, 2026-08-10 — see packages/ui/src/components/session-card.tsx's own comment). */
export function SessionsList(): React.JSX.Element {
  const queryClient = useQueryClient();
  const sessionsQuery = useQuery({
    queryKey: ["auth", "sessions"],
    queryFn: () => authService.sessions(),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => authService.revokeSession(id),
    onSuccess: () => {
      toast.success("Session revoked");
      void queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to revoke session");
    },
  });

  const logoutAllMutation = useMutation({
    mutationFn: () => authService.logoutAll(),
    onSuccess: () => {
      toast.success("Signed out of all devices");
      window.location.assign("/login");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to sign out of all devices");
    },
  });

  if (sessionsQuery.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const sessions = sessionsQuery.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          variant="destructive"
          size="sm"
          onClick={() => logoutAllMutation.mutate()}
          loading={logoutAllMutation.isPending}
        >
          Log out of all devices
        </Button>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          title="No active sessions"
          description="Your active sessions will appear here."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((session) => {
            const { device, browser } = parseUserAgent(session.userAgent);
            return (
              <SessionCard
                key={session.id}
                device={device}
                browser={browser}
                ipAddress={session.ipAddress}
                lastActiveAt={new Date(session.createdAt).toLocaleString()}
                onRevoke={() => revokeMutation.mutate(session.id)}
                revoking={revokeMutation.isPending && revokeMutation.variables === session.id}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
