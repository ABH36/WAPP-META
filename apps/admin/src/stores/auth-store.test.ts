import { describe, it, expect, beforeEach } from "vitest";
import { PlatformRole } from "@wapp/shared-types";
import { useAuthStore } from "./auth-store";
import type { PlatformUser } from "../types/auth";

const fakeUser: PlatformUser = {
  platformUserId: "platform-user-1",
  role: PlatformRole.PLATFORM_SUPER_ADMIN,
};

describe("useAuthStore (admin)", () => {
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

  it("clear resets user/token and marks unauthenticated", () => {
    useAuthStore.getState().setSession(fakeUser, "access-token-1");
    useAuthStore.getState().clear();
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.status).toBe("unauthenticated");
  });
});
