import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";
import { REFRESH_TOKEN_COOKIE } from "./lib/auth-cookie";

function makeRequest(path: string, cookie?: string): NextRequest {
  const url = `http://localhost:3001${path}`;
  const headers = cookie ? { cookie: `${REFRESH_TOKEN_COOKIE}=${cookie}` } : undefined;
  return new NextRequest(url, { headers });
}

describe("middleware (admin — no public routes, every path but /login is protected)", () => {
  it("redirects an unauthenticated request for the dashboard to /login with redirectTo", () => {
    const res = middleware(makeRequest("/"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/login");
    expect(location).toContain("redirectTo=%2F");
  });

  it("allows an authenticated request through", () => {
    const res = middleware(makeRequest("/", "some-refresh-token"));
    expect(res.status).toBe(200);
  });

  it("allows an unauthenticated request through to /login", () => {
    const res = middleware(makeRequest("/login"));
    expect(res.status).toBe(200);
  });

  it("redirects an authenticated request away from /login", () => {
    const res = middleware(makeRequest("/login", "some-refresh-token"));
    expect(res.status).toBe(307);
  });
});
