import { Test } from "@nestjs/testing";
import { VersioningType, type INestApplication } from "@nestjs/common";
import type { Server } from "http";
import { Types } from "mongoose";
import request from "supertest";
import type { ApiSuccessResponse } from "@wapp/shared-types";
import { AppModule } from "../src/app.module.js";
import { EmailService } from "../src/infrastructure/email/email.service.js";
import type { SendEmailJob } from "../src/infrastructure/email/email.types.js";
import type { IssuedTokenPair } from "../src/modules/identity/identity.types.js";
import type { WorkspaceProfile } from "../src/modules/workspace/workspace.types.js";
import { PhoneNumberRepository } from "../src/modules/communication/repositories/phone-number.repository.js";
import { WhatsAppConnectionRepository } from "../src/modules/communication/repositories/whatsapp-connection.repository.js";
import { QualityRating } from "../src/modules/communication/schemas/phone-number.schema.js";
import { MetaApiClient } from "../src/modules/communication/services/meta-api-client.service.js";
import { TokenEncryptionService } from "../src/common/security/token-encryption.service.js";
import type {
  ActivityReport,
  DashboardSummary,
  DealReport,
  ForecastReport,
  LeadConversionResult,
  LeadReport,
  LeadSummary,
  TeamPerformanceReport,
} from "../src/modules/crm/crm.types.js";

/**
 * Covers Phase-5 Part-6 (PRD-004 Volume-6, CRM Reports & Dashboard) end-to-
 * end against the real replica-set Mongo: dashboard totals, Lead/Deal/
 * Activity report aggregations, Team Performance, Forecast, CSV/Excel
 * export, workspace isolation, and VIEW_REPORTS being workspace-wide
 * (resolved 2026-08-07 — a Sales Executive, OWN_SCOPED on paper, sees the
 * same totals as the Owner).
 */
describe("CRM Reports & Dashboard (e2e)", () => {
  let app: INestApplication;
  let sentEmails: SendEmailJob[];
  let phoneNumberRepository: PhoneNumberRepository;
  let connectionRepository: WhatsAppConnectionRepository;

  const runId = Date.now();
  const ownerEmail = `reports-owner-${runId}@example.com`;
  const ownerMobile = `+9519${String(runId).slice(-8)}`;
  const execEmail = `reports-exec-${runId}@example.com`;
  const execMobile = `+9529${String(runId).slice(-8)}`;
  const password = "Passw0rd1";
  const metaPhoneNumberId = `meta-phone-reports-${runId}`;
  const wonMobile = `+9541${String(runId).slice(-7)}1`;
  const lostMobile = `+9541${String(runId).slice(-7)}2`;

  let workspaceId: string;
  let ownerAccessToken: string;
  let salesExecutiveAccessToken: string;

  beforeAll(async () => {
    sentEmails = [];
    const metaApiClient = { sendTextMessage: jest.fn(), sendTemplateMessage: jest.fn() };

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
      .overrideProvider(MetaApiClient)
      .useValue(metaApiClient)
      .compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    app.setGlobalPrefix("api");
    await app.init();

    phoneNumberRepository = moduleRef.get(PhoneNumberRepository);
    connectionRepository = moduleRef.get(WhatsAppConnectionRepository);
    const tokenEncryption = moduleRef.get(TokenEncryptionService);

    await request(server()).post("/api/v1/auth/register").send({
      fullName: "Reports Owner",
      email: ownerEmail,
      mobileNumber: ownerMobile,
      password,
    });
    const verifyToken = extractToken(extractLink(ownerEmail));
    const verifyRes = await request(server())
      .post("/api/v1/auth/verify-email")
      .send({ token: verifyToken });
    const tokens = (verifyRes.body as ApiSuccessResponse<{ tokens: IssuedTokenPair }>).data.tokens;

    const createRes = await request(server())
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${tokens.accessToken}`)
      .send({ name: "Reports Test Co" });
    const createBody = createRes.body as ApiSuccessResponse<{
      workspace: WorkspaceProfile;
      tokens: IssuedTokenPair;
    }>;
    workspaceId = createBody.data.workspace.id;
    ownerAccessToken = createBody.data.tokens.accessToken;

    await phoneNumberRepository.upsert(
      workspaceId,
      new Types.ObjectId().toString(),
      metaPhoneNumberId,
      {
        displayPhoneNumber: "+91 90000 00012",
        verifiedName: "Reports Test Co",
        qualityRating: QualityRating.GREEN,
        messagingLimitTier: "TIER_1K",
      },
    );
    await connectionRepository.upsertForWorkspace({
      workspaceId,
      wabaId: `waba-reports-${runId}`,
      businessName: "Reports Test Co",
      accessTokenEncrypted: tokenEncryption.encrypt("fake-access-token"),
      connectedBy: new Types.ObjectId().toString(),
    });

    salesExecutiveAccessToken = (
      await inviteAndAccept(execEmail, execMobile, "Exec", "SALES_EXECUTIVE")
    ).accessToken;

    // --- Seed data ---
    await request(server())
      .post("/api/v1/crm/customers")
      .set("Authorization", `Bearer ${ownerAccessToken}`)
      .send({
        customerName: "Report Customer A",
        mobileNumber: `+9551${String(runId).slice(-7)}1`,
      });
    await request(server())
      .post("/api/v1/crm/customers")
      .set("Authorization", `Bearer ${ownerAccessToken}`)
      .send({
        customerName: "Report Customer B",
        mobileNumber: `+9551${String(runId).slice(-7)}2`,
      });

    const { dealId: wonDealId } = await createLeadWonAndConvert("Won Deal Opportunity", wonMobile);
    await authed("patch", `/api/v1/crm/deals/${wonDealId}`).send({
      value: 100000,
      probability: 100,
    });
    // OPEN -> WON directly is an illegal transition (no skipping stages,
    // §7) — must walk through the full non-terminal pipeline first.
    for (const stage of ["QUALIFICATION", "PROPOSAL", "NEGOTIATION", "WON"]) {
      const stageRes = await authed("patch", `/api/v1/crm/deals/${wonDealId}/stage`).send({
        stage,
      });
      if (stageRes.status !== 200) {
        throw new Error(`Seeding wonDeal to ${stage} failed: ${JSON.stringify(stageRes.body)}`);
      }
    }

    const { dealId: lostDealId } = await createLeadWonAndConvert(
      "Lost Deal Opportunity",
      lostMobile,
    );
    await authed("patch", `/api/v1/crm/deals/${lostDealId}`).send({
      value: 50000,
      probability: 20,
      expectedCloseDate: "2026-09-15T00:00:00.000Z",
    });
    const lostStageRes = await authed("patch", `/api/v1/crm/deals/${lostDealId}/stage`).send({
      stage: "LOST",
      lostReason: "PRICE",
    });
    if (lostStageRes.status !== 200) {
      throw new Error(`Seeding lostDeal to LOST failed: ${JSON.stringify(lostStageRes.body)}`);
    }

    const customersRes = await authed("get", "/api/v1/crm/customers");
    const customerId = (customersRes.body as ApiSuccessResponse<{ id: string }[]>).data[0]!.id;

    await authed("post", "/api/v1/crm/activities").send({
      type: "TASK",
      customerId,
      title: "Overdue task",
      dueDate: "2020-01-01T00:00:00.000Z",
    });

    const completedTaskRes = await authed("post", "/api/v1/crm/activities").send({
      type: "TASK",
      customerId,
      title: "Completed task",
    });
    const completedTaskId = (completedTaskRes.body as ApiSuccessResponse<{ id: string }>).data.id;
    await authed("patch", `/api/v1/crm/tasks/${completedTaskId}/status`).send({
      status: "COMPLETED",
    });

    await authed("post", "/api/v1/crm/activities").send({
      type: "CALL",
      customerId,
      description: "Discovery call",
    });
    await authed("post", "/api/v1/crm/activities").send({
      type: "MEETING",
      customerId,
      description: "Kickoff meeting",
    });
    await authed("post", "/api/v1/crm/notes").send({ customerId, text: "Note for reporting" });
  });

  afterAll(async () => {
    await app.close();
  });

  function server(): Server {
    return app.getHttpServer() as Server;
  }

  function authed(method: "get" | "post" | "patch", path: string, token = ownerAccessToken) {
    return request(server())[method](path).set("Authorization", `Bearer ${token}`);
  }

  function extractToken(link: string): string {
    return new URL(link).searchParams.get("token") ?? "";
  }

  function extractLink(to: string, category = "email-verification"): string {
    const job = sentEmails.find((email) => email.to === to && email.category === category);
    const link = job?.html.match(/href="([^"]+)"/)?.[1];
    if (!link) {
      throw new Error(`No ${category} email found for ${to}`);
    }
    return link;
  }

  async function inviteAndAccept(
    email: string,
    mobileNumber: string,
    fullName: string,
    role: string,
  ): Promise<{ accessToken: string }> {
    await request(server()).post("/api/v1/auth/register").send({
      fullName,
      email,
      mobileNumber,
      password,
    });
    const verifyToken = extractToken(extractLink(email));
    const verifyRes = await request(server())
      .post("/api/v1/auth/verify-email")
      .send({ token: verifyToken });
    const memberTokens = (verifyRes.body as ApiSuccessResponse<{ tokens: IssuedTokenPair }>).data
      .tokens;

    if (!role) {
      // A second, standalone workspace owner — used only for the workspace-isolation check.
      return { accessToken: memberTokens.accessToken };
    }

    await authed("post", "/api/v1/team/invitations").send({ email, role });
    const inviteToken = extractToken(extractLink(email, "team-invitation"));
    const acceptRes = await request(server())
      .post("/api/v1/team/invitations/accept")
      .set("Authorization", `Bearer ${memberTokens.accessToken}`)
      .send({ token: inviteToken });
    const acceptBody = (acceptRes.body as ApiSuccessResponse<{ tokens: IssuedTokenPair }>).data;

    return { accessToken: acceptBody.tokens.accessToken };
  }

  async function createLeadWonAndConvert(
    leadName: string,
    mobileNumber: string,
  ): Promise<{ leadId: string; dealId: string }> {
    const createRes = await authed("post", "/api/v1/crm/leads").send({
      leadName,
      mobileNumber,
      source: "MANUAL_ENTRY",
    });
    const lead = (createRes.body as ApiSuccessResponse<LeadSummary>).data;

    for (const status of ["CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON"]) {
      await authed("patch", `/api/v1/crm/leads/${lead.id}/status`).send({ status });
    }

    const convertRes = await authed("post", `/api/v1/crm/leads/${lead.id}/convert`);
    const result = (convertRes.body as ApiSuccessResponse<LeadConversionResult>).data;

    return { leadId: lead.id, dealId: result.dealId };
  }

  it("dashboard reflects the seeded Customers/Leads/Deals/Activities", async () => {
    const res = await authed("get", "/api/v1/crm/reports/dashboard");
    expect(res.status).toBe(200);
    const dashboard = (res.body as ApiSuccessResponse<DashboardSummary>).data;

    expect(dashboard.totalCustomers).toBeGreaterThanOrEqual(2);
    expect(dashboard.totalDeals).toBeGreaterThanOrEqual(2);
    expect(dashboard.wonDeals).toBeGreaterThanOrEqual(1);
    expect(dashboard.lostDeals).toBeGreaterThanOrEqual(1);
    expect(dashboard.pipelineValue).toBe(0); // both seeded Deals are already terminal (WON/LOST)
    expect(dashboard.overdueTasks).toBeGreaterThanOrEqual(1);
  });

  it("lead report returns source/status distributions and rates within [0,100]", async () => {
    const res = await authed("get", "/api/v1/crm/reports/leads");
    expect(res.status).toBe(200);
    const report = (res.body as ApiSuccessResponse<LeadReport>).data;

    expect(report.totalLeads).toBeGreaterThanOrEqual(2);
    expect(report.leadSourceDistribution.some((e) => e.key === "MANUAL_ENTRY")).toBe(true);
    expect(report.conversionRate).toBeGreaterThan(0);
    expect(report.conversionRate).toBeLessThanOrEqual(100);
    expect(report.lostRate).toBeGreaterThanOrEqual(0);
  });

  it("deal report shows Won/Lost counts, forecast revenue, and average sales cycle", async () => {
    const res = await authed("get", "/api/v1/crm/reports/deals");
    expect(res.status).toBe(200);
    const report = (res.body as ApiSuccessResponse<DealReport>).data;

    expect(report.wonCount).toBeGreaterThanOrEqual(1);
    expect(report.lostCount).toBeGreaterThanOrEqual(1);
    // Both seeded Deals are terminal (WON/LOST), so no OPEN-stage value contributes to forecast.
    expect(report.forecastRevenue).toBe(0);
    expect(report.averageSalesCycleHours).not.toBeNull();
    expect(report.averageSalesCycleHours!).toBeGreaterThanOrEqual(0);
  });

  it("activity report counts Tasks/Calls/Meetings/Notes and overdue-style Follow-ups Due", async () => {
    const res = await authed("get", "/api/v1/crm/reports/activities");
    expect(res.status).toBe(200);
    const report = (res.body as ApiSuccessResponse<ActivityReport>).data;

    expect(report.tasksPending).toBeGreaterThanOrEqual(1);
    expect(report.tasksCompleted).toBeGreaterThanOrEqual(1);
    expect(report.callsLogged).toBeGreaterThanOrEqual(1);
    expect(report.meetingsLogged).toBeGreaterThanOrEqual(1);
    expect(report.notesCreated).toBeGreaterThanOrEqual(1);
  });

  it("team performance is empty for this workspace (all seeded work is unassigned)", async () => {
    const res = await authed("get", "/api/v1/crm/reports/team-performance");
    expect(res.status).toBe(200);
    const report = (res.body as ApiSuccessResponse<TeamPerformanceReport>).data;
    expect(report.entries).toEqual([]);
  });

  it("forecast report has no pipeline value (both Deals are terminal) but returns well-formed buckets", async () => {
    const res = await authed("get", "/api/v1/crm/reports/forecast");
    expect(res.status).toBe(200);
    const report = (res.body as ApiSuccessResponse<ForecastReport>).data;
    expect(report.pipelineForecast).toBe(0);
    expect(Array.isArray(report.monthlyForecast)).toBe(true);
  });

  it("exports the dashboard report as CSV with the right headers", async () => {
    const res = await authed("get", "/api/v1/crm/reports/export?type=dashboard&format=csv");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain("dashboard-report.csv");
    expect(res.text).toContain("Total Customers");
  });

  it("exports the deals report as Excel with the right headers", async () => {
    const res = await authed("get", "/api/v1/crm/reports/export?type=deals&format=excel");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("spreadsheetml");
    expect(res.headers["content-disposition"]).toContain("deals-report.xlsx");
    expect(Number(res.headers["content-length"])).toBeGreaterThan(0);
  });

  it("a Sales Executive (OWN_SCOPED on paper) sees the same workspace-wide totals as the Owner", async () => {
    const ownerRes = await authed("get", "/api/v1/crm/reports/dashboard");
    const execRes = await authed("get", "/api/v1/crm/reports/dashboard", salesExecutiveAccessToken);

    expect(execRes.status).toBe(200);
    const ownerData = (ownerRes.body as ApiSuccessResponse<DashboardSummary>).data;
    const execData = (execRes.body as ApiSuccessResponse<DashboardSummary>).data;
    expect(execData).toEqual(ownerData);
  });

  it("respects workspace isolation: a different workspace has none of this data", async () => {
    const otherOwner = await inviteAndAccept(
      `reports-isolated-${runId}@example.com`,
      `+9591${String(runId).slice(-8)}`,
      "Isolated Owner",
      "",
    );
    const createRes = await request(server())
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${otherOwner.accessToken}`)
      .send({ name: "Isolated Reports Co" });
    const otherTokens = (createRes.body as ApiSuccessResponse<{ tokens: IssuedTokenPair }>).data
      .tokens;

    const res = await request(server())
      .get("/api/v1/crm/reports/dashboard")
      .set("Authorization", `Bearer ${otherTokens.accessToken}`);

    expect(res.status).toBe(200);
    const dashboard = (res.body as ApiSuccessResponse<DashboardSummary>).data;
    expect(dashboard.totalCustomers).toBe(0);
    expect(dashboard.totalDeals).toBe(0);
  });
});
