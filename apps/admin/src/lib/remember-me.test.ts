import { describe, it, expect, beforeEach } from "vitest";
import { getRememberMe, refreshTokenCookieMaxAge, setRememberMe } from "./remember-me";

describe("remember-me (admin)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to true (persistent) when nothing has been set yet", () => {
    expect(getRememberMe()).toBe(true);
    expect(refreshTokenCookieMaxAge()).toBe(30 * 24 * 60 * 60);
  });

  it("persists false and returns undefined maxAge (session cookie) when unchecked", () => {
    setRememberMe(false);
    expect(getRememberMe()).toBe(false);
    expect(refreshTokenCookieMaxAge()).toBeUndefined();
  });
});
