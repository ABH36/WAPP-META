import { Test } from "@nestjs/testing";
import { DiagnosticsService } from "./diagnostics.service.js";
import { HealthCheckService } from "../../../health/health-check.service.js";
import { WhatsAppIntegrationService } from "./whatsapp-integration.service.js";
import { WhatsAppConnectionStatus } from "../../communication/schemas/whatsapp-connection.schema.js";

describe("DiagnosticsService", () => {
  let service: DiagnosticsService;
  let healthCheckService: jest.Mocked<HealthCheckService>;
  let whatsAppIntegrationService: jest.Mocked<WhatsAppIntegrationService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        DiagnosticsService,
        { provide: HealthCheckService, useValue: { getChecks: jest.fn() } },
        { provide: WhatsAppIntegrationService, useValue: { getSummary: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(DiagnosticsService);
    healthCheckService = moduleRef.get(HealthCheckService);
    whatsAppIntegrationService = moduleRef.get(WhatsAppIntegrationService);
  });

  it("reports UP for every check that passes and composes WhatsApp status", async () => {
    healthCheckService.getChecks.mockResolvedValue({
      database: true,
      redis: true,
      queue: true,
      storage: true,
      email: true,
    });
    whatsAppIntegrationService.getSummary.mockResolvedValue({
      connected: true,
      wabaId: "waba-1",
      businessName: "Acme",
      status: WhatsAppConnectionStatus.CONNECTED,
    });

    const result = await service.getDiagnostics("workspace-1");

    expect(result.checks).toEqual([
      { name: "database", status: "UP" },
      { name: "redis", status: "UP" },
      { name: "queue", status: "UP" },
      { name: "storage", status: "UP" },
      { name: "email", status: "UP" },
      { name: "whatsapp", status: "UP" },
    ]);
  });

  it("reports whatsapp DOWN when not connected", async () => {
    healthCheckService.getChecks.mockResolvedValue({
      database: true,
      redis: true,
      queue: true,
      storage: true,
      email: true,
    });
    whatsAppIntegrationService.getSummary.mockResolvedValue({
      connected: false,
      wabaId: null,
      businessName: null,
      status: null,
    });

    const result = await service.getDiagnostics("workspace-1");

    expect(result.checks.find((c) => c.name === "whatsapp")?.status).toBe("DOWN");
  });

  it("reports whatsapp DOWN when connected but in an ERROR state", async () => {
    healthCheckService.getChecks.mockResolvedValue({
      database: true,
      redis: true,
      queue: true,
      storage: true,
      email: true,
    });
    whatsAppIntegrationService.getSummary.mockResolvedValue({
      connected: true,
      wabaId: "waba-1",
      businessName: "Acme",
      status: WhatsAppConnectionStatus.ERROR,
    });

    const result = await service.getDiagnostics("workspace-1");

    expect(result.checks.find((c) => c.name === "whatsapp")?.status).toBe("DOWN");
  });

  it("reports DOWN for a failing platform check", async () => {
    healthCheckService.getChecks.mockResolvedValue({
      database: true,
      redis: false,
      queue: false,
      storage: true,
      email: true,
    });
    whatsAppIntegrationService.getSummary.mockResolvedValue({
      connected: false,
      wabaId: null,
      businessName: null,
      status: null,
    });

    const result = await service.getDiagnostics("workspace-1");

    expect(result.checks.find((c) => c.name === "redis")?.status).toBe("DOWN");
    expect(result.checks.find((c) => c.name === "queue")?.status).toBe("DOWN");
  });
});
