import { describe, it, expect } from "vitest";
import { parseUserAgent } from "./user-agent";

describe("parseUserAgent", () => {
  it("returns Unknown for a null user agent", () => {
    expect(parseUserAgent(null)).toEqual({ browser: "Unknown browser", device: "Unknown device" });
  });

  it("detects Chrome on Windows", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(parseUserAgent(ua)).toEqual({ browser: "Chrome", device: "Windows" });
  });

  it("detects Safari on Mac", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
    expect(parseUserAgent(ua)).toEqual({ browser: "Safari", device: "Mac" });
  });

  it("detects Firefox", () => {
    const ua = "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0";
    expect(parseUserAgent(ua).browser).toBe("Firefox");
  });

  it("detects Edge", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
    expect(parseUserAgent(ua).browser).toBe("Edge");
  });

  it("detects Mobile for an iPhone user agent", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    expect(parseUserAgent(ua).device).toBe("Mobile");
  });

  it("falls back to Unknown browser for an unrecognized string", () => {
    expect(parseUserAgent("SomeBot/1.0").browser).toBe("Unknown browser");
  });
});
