import { Test } from "@nestjs/testing";
import { VersioningType, type INestApplication } from "@nestjs/common";
import type { Server } from "http";
import request from "supertest";
import cookieParser from "cookie-parser";
import type { ApiErrorResponse, ApiSuccessResponse } from "@wapp/shared-types";
import { AppModule } from "../src/app.module.js";
import { EmailService } from "../src/infrastructure/email/email.service.js";
import type { SendEmailJob } from "../src/infrastructure/email/email.types.js";

const REFRESH_TOKEN_COOKIE = "wapp_web_rt";

/**
 * Full Identity & Authentication flow against live Docker Mongo/Redis
 * (docker-compose.yml). The only thing swapped out is EmailService — real
 * delivery goes through BullMQ/Resend asynchronously, which this test can't
 * deterministically observe, so we capture the outgoing job synchronously
 * instead and pull the verification/reset link out of it. Everything else
 * (Mongo persistence, bcrypt hashing, JWT signing, Redis-backed rate
 * limiting) runs for real.
 */
describe("Auth (e2e)", () => {
  let app: INestApplication;
  let sentEmails: SendEmailJob[];

  const runId = Date.now();
  const testEmail = `e2e-${runId}@example.com`;
  const testMobile = `+9199${String(runId).slice(-8)}`;
  const testPassword = "Passw0rd1";

  beforeAll(async () => {
    sentEmails = [];
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue({
        send: jest.fn((job: SendEmailJob) => {
          sentEmails.push(job);
          return Promise.resolve();
        }),
      })
      .compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.use(cookieParser());
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    app.setGlobalPrefix("api");
    await app.init();
  });

  // NOTE: sentEmails accumulates for the whole suite on purpose — these tests
  // are sequential/stateful (register -> verify -> login -> reset ...), each
  // depending on state a prior test produced. Do not reset it per-test.

  afterAll(async () => {
    await app.close();
  });

  function server(): Server {
    return app.getHttpServer() as Server;
  }

  function extractTokenFromLink(link: string): string {
    const url = new URL(link);
    const token = url.searchParams.get("token");
    if (!token) {
      throw new Error(`No token found in link: ${link}`);
    }
    return token;
  }

  // PHD-001 Volume-1 — the refresh token now travels as an httpOnly Set-Cookie
  // header, never in the JSON response body; tests must read/replay it as a
  // cookie, same as a real browser would.
  function extractRefreshCookie(response: request.Response): string {
    const setCookieHeader = response.headers["set-cookie"] as string[] | string | undefined;
    const cookies = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : setCookieHeader
        ? [setCookieHeader]
        : [];
    const raw = cookies.find((cookie) => cookie.startsWith(`${REFRESH_TOKEN_COOKIE}=`));
    if (!raw) {
      throw new Error(`No ${REFRESH_TOKEN_COOKIE} cookie in response`);
    }
    return raw.split(";")[0] as string;
  }

  it("rejects registration with a weak password", async () => {
    const response = await request(server())
      .post("/api/v1/auth/register")
      .send({
        fullName: "Weak Password",
        email: `weak-${runId}@example.com`,
        mobileNumber: `+9188${String(runId).slice(-8)}`,
        password: "weak",
      });
    expect(response.status).toBe(400);
    expect((response.body as ApiErrorResponse).success).toBe(false);
  });

  it("registers a new account and queues a verification email", async () => {
    const response = await request(server()).post("/api/v1/auth/register").send({
      fullName: "E2E Test User",
      email: testEmail,
      mobileNumber: testMobile,
      password: testPassword,
    });

    expect(response.status).toBe(201);
    const body = response.body as ApiSuccessResponse<{ email: string }>;
    expect(body.success).toBe(true);
    expect(body.data.email).toBe(testEmail);
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]?.category).toBe("email-verification");
  });

  it("rejects a duplicate email at registration", async () => {
    const response = await request(server())
      .post("/api/v1/auth/register")
      .send({
        fullName: "Duplicate",
        email: testEmail,
        mobileNumber: `+9177${String(runId).slice(-8)}`,
        password: testPassword,
      });
    expect(response.status).toBe(409);
  });

  it("blocks login before the email is verified (LOGIN-BR-001)", async () => {
    const response = await request(server())
      .post("/api/v1/auth/login")
      .send({ email: testEmail, password: testPassword });
    expect(response.status).toBe(403);
  });

  it("rejects an invalid verification token", async () => {
    const response = await request(server())
      .post("/api/v1/auth/verify-email")
      .send({ token: "not-a-real-token" });
    expect(response.status).toBe(400);
  });

  let accessToken: string;
  let refreshToken: string;

  it("verifies the email and auto-issues a token pair", async () => {
    const verificationLink = sentEmails
      .find((job) => job.category === "email-verification")
      ?.html.match(/href="([^"]+)"/)?.[1];
    expect(verificationLink).toBeDefined();
    const token = extractTokenFromLink(verificationLink as string);

    const response = await request(server()).post("/api/v1/auth/verify-email").send({ token });
    expect(response.status).toBe(201);

    const body = response.body as ApiSuccessResponse<{ tokens: { accessToken: string } }>;
    expect(body.data.tokens.accessToken).toBeDefined();
    accessToken = body.data.tokens.accessToken;
    refreshToken = extractRefreshCookie(response);
  });

  it("rejects reusing an already-used verification token", async () => {
    const verificationLink = sentEmails
      .find((job) => job.category === "email-verification")
      ?.html.match(/href="([^"]+)"/)?.[1];
    const token = extractTokenFromLink(verificationLink as string);
    const response = await request(server()).post("/api/v1/auth/verify-email").send({ token });
    expect(response.status).toBe(400);
  });

  it("logs in successfully once verified", async () => {
    const response = await request(server())
      .post("/api/v1/auth/login")
      .send({ email: testEmail, password: testPassword });
    expect(response.status).toBe(201);
    const body = response.body as ApiSuccessResponse<{
      tokens: { accessToken: string };
      user: { email: string; isEmailVerified: boolean };
    }>;
    expect(body.data.user.email).toBe(testEmail);
    expect(body.data.user.isEmailVerified).toBe(true);
  });

  it("rejects login with the wrong password", async () => {
    const response = await request(server())
      .post("/api/v1/auth/login")
      .send({ email: testEmail, password: "WrongPassword1" });
    expect(response.status).toBe(401);
  });

  it("rejects unauthenticated access to a protected route", async () => {
    const response = await request(server()).get("/api/v1/auth/me");
    expect(response.status).toBe(401);
  });

  it("returns the current user profile when authenticated", async () => {
    const response = await request(server())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(response.status).toBe(200);
    const body = response.body as ApiSuccessResponse<{ email: string }>;
    expect(body.data.email).toBe(testEmail);
  });

  it("lists the active session created at login/verification", async () => {
    const response = await request(server())
      .get("/api/v1/auth/sessions")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(response.status).toBe(200);
    const body = response.body as ApiSuccessResponse<unknown[]>;
    expect(body.data.length).toBeGreaterThan(0);
  });

  let rotatedRefreshToken: string;

  it("rotates the refresh token pair", async () => {
    const response = await request(server())
      .post("/api/v1/auth/refresh")
      .set("Cookie", refreshToken);
    expect(response.status).toBe(201);
    const body = response.body as ApiSuccessResponse<{ accessToken: string }>;
    expect(body.data.accessToken).toBeDefined();
    rotatedRefreshToken = extractRefreshCookie(response);
    expect(rotatedRefreshToken).not.toBe(refreshToken);
  });

  it("detects reuse of a rotated-out refresh token and revokes the whole chain", async () => {
    // The original token (already rotated above) is presented again.
    const reuseResponse = await request(server())
      .post("/api/v1/auth/refresh")
      .set("Cookie", refreshToken);
    expect(reuseResponse.status).toBe(401);

    // Reuse detection must have revoked the *rotated* token too.
    const rotatedResponse = await request(server())
      .post("/api/v1/auth/refresh")
      .set("Cookie", rotatedRefreshToken);
    expect(rotatedResponse.status).toBe(401);
  });

  it("supports the forgot-password / reset-password flow and revokes existing sessions", async () => {
    const forgotResponse = await request(server())
      .post("/api/v1/auth/forgot-password")
      .send({ email: testEmail });
    expect(forgotResponse.status).toBe(201);

    const resetEmail = sentEmails.find((job) => job.category === "password-reset");
    expect(resetEmail).toBeDefined();
    const resetLink = resetEmail?.html.match(/href="([^"]+)"/)?.[1];
    const token = extractTokenFromLink(resetLink as string);

    const newPassword = "NewPassw0rd1";
    const resetResponse = await request(server())
      .post("/api/v1/auth/reset-password")
      .send({ token, newPassword });
    expect(resetResponse.status).toBe(201);

    // Old password no longer works.
    const oldLoginResponse = await request(server())
      .post("/api/v1/auth/login")
      .send({ email: testEmail, password: testPassword });
    expect(oldLoginResponse.status).toBe(401);

    // New password works.
    const newLoginResponse = await request(server())
      .post("/api/v1/auth/login")
      .send({ email: testEmail, password: newPassword });
    expect(newLoginResponse.status).toBe(201);
  });

  it("throttles repeated login attempts (SEC-009, 5/min)", async () => {
    const attempts = await Promise.all(
      Array.from({ length: 7 }, () =>
        request(server())
          .post("/api/v1/auth/login")
          .send({ email: testEmail, password: "definitely-wrong" }),
      ),
    );
    const throttled = attempts.filter((response) => response.status === 429);
    expect(throttled.length).toBeGreaterThan(0);
  });
});
