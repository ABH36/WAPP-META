import { describe, it, expect } from "vitest";
import { formatLoginReason } from "./login-reason";

describe("formatLoginReason", () => {
  it("returns 'Successful login' when success is true, regardless of reason", () => {
    expect(formatLoginReason(null, true)).toBe("Successful login");
  });

  it("maps every known backend reason to friendly copy", () => {
    expect(formatLoginReason("INVALID_CREDENTIALS", false)).toBe("Incorrect email or password");
    expect(formatLoginReason("ACCOUNT_LOCKED", false)).toBe("Account temporarily locked");
    expect(formatLoginReason("PLATFORM_MAINTENANCE_MODE", false)).toBe(
      "Platform under maintenance",
    );
    expect(formatLoginReason("WORKSPACE_SUSPENDED_OR_ARCHIVED", false)).toBe("Workspace suspended");
  });

  it("falls back to 'Failed login' for an unrecognized reason", () => {
    expect(formatLoginReason("SOME_NEW_BACKEND_REASON", false)).toBe("Failed login");
  });

  it("falls back to 'Failed login' for a null reason on failure", () => {
    expect(formatLoginReason(null, false)).toBe("Failed login");
  });
});
