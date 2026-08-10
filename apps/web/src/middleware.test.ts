import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";
import { REFRESH_TOKEN_COOKIE } from "./lib/auth-cookie";

function makeRequest(path: string, cookie?: string): NextRequest {
  const url = `http://localhost:3000${path}`;
  const headers = cookie ? { cookie: `${REFRESH_TOKEN_COOKIE}=${cookie}` } : undefined;
  return new NextRequest(url, { headers });
}

describe("middleware (Protected/Guest Routes)", () => {
  it("redirects an unauthenticated request for a protected route to /login with redirectTo", () => {
    const res = middleware(makeRequest("/dashboard"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/login");
    expect(location).toContain("redirectTo=%2Fdashboard");
  });

  it("allows an authenticated request through to a protected route", () => {
    const res = middleware(makeRequest("/dashboard", "some-refresh-token"));
    expect(res.status).toBe(200);
  });

  it("allows an unauthenticated request through to a guest-only route", () => {
    const res = middleware(makeRequest("/login"));
    expect(res.status).toBe(200);
  });

  it("redirects an authenticated request away from a guest-only route", () => {
    const res = middleware(makeRequest("/login", "some-refresh-token"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("allows an unauthenticated request through to a public route", () => {
    const res = middleware(makeRequest("/"));
    expect(res.status).toBe(200);
  });
});
