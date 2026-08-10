import { describe, it, expect, afterEach } from "vitest";
import { deleteCookie, getCookie, setCookie } from "./cookies";

describe("cookies", () => {
  afterEach(() => {
    document.cookie.split(";").forEach((c) => {
      const name = c.split("=")[0]?.trim();
      if (name) document.cookie = `${name}=; Max-Age=0; Path=/`;
    });
  });

  it("sets and reads a cookie", () => {
    setCookie("test_cookie", "hello world", 60);
    expect(getCookie("test_cookie")).toBe("hello world");
  });

  it("returns null for a cookie that was never set", () => {
    expect(getCookie("nonexistent")).toBeNull();
  });

  it("deletes a cookie", () => {
    setCookie("to_delete", "value", 60);
    expect(getCookie("to_delete")).toBe("value");
    deleteCookie("to_delete");
    expect(getCookie("to_delete")).toBeNull();
  });

  it("URL-encodes and decodes special characters", () => {
    setCookie("special", "a;b=c d", 60);
    expect(getCookie("special")).toBe("a;b=c d");
  });

  it("FRD-001 Volume-2 — sets a session cookie (still readable) when maxAgeSeconds is omitted", () => {
    setCookie("session_only", "value");
    expect(getCookie("session_only")).toBe("value");
  });
});
