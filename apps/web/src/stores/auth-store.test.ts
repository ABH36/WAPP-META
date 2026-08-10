import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "./auth-store";
import type { UserProfile } from "../types/auth";

const fakeUser: UserProfile = {
  id: "user-1",
  fullName: "Jane Owner",
  email: "jane@example.com",
  mobileNumber: "+919876543210",
  workspaceId: "workspace-1",
  role: null,
  workspaceMemberStatus: null,
  isEmailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("useAuthStore", () => {
  beforeEach(() => {
    useAuthStore.setState({ status: "idle", user: null, accessToken: null });
  });

  it("starts idle with no user or token", () => {
    const state = useAuthStore.getState();
    expect(state.status).toBe("idle");
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
  });

  it("setSession sets user, accessToken, and marks authenticated", () => {
    useAuthStore.getState().setSession(fakeUser, "access-token-1");
    const state = useAuthStore.getState();
    expect(state.user).toEqual(fakeUser);
    expect(state.accessToken).toBe("access-token-1");
    expect(state.status).toBe("authenticated");
  });

  it("setAccessToken updates only the token, not the user or status", () => {
    useAuthStore.getState().setSession(fakeUser, "old-token");
    useAuthStore.getState().setAccessToken("rotated-token");
    const state = useAuthStore.getState();
    expect(state.accessToken).toBe("rotated-token");
    expect(state.user).toEqual(fakeUser);
    expect(state.status).toBe("authenticated");
  });

  it("clear resets user/token and marks unauthenticated", () => {
    useAuthStore.getState().setSession(fakeUser, "access-token-1");
    useAuthStore.getState().clear();
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.status).toBe("unauthenticated");
  });

  it("setStatus updates status independently", () => {
    useAuthStore.getState().setStatus("loading");
    expect(useAuthStore.getState().status).toBe("loading");
  });
});
