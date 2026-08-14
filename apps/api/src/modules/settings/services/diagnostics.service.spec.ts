import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { DiagnosticsService } from "./diagnostics.service.js";
import { HealthCheckService } from "../../../health/health-check.service.js";
import { QueueStatusService } from "../../../infrastructure/queue/queue-status.service.js";
import { WhatsAppIntegrationService } from "./whatsapp-integration.service.js";
import { FeatureFlagsService } from "./feature-flags.service.js";
import { WhatsAppConnectionStatus } from "../../communication/schemas/whatsapp-connection.schema.js";

describe("DiagnosticsService", () => {
  let service: DiagnosticsService;
  let healthCheckService: jest.Mocked<HealthCheckService>;
  let whatsAppIntegrationService: jest.Mocked<WhatsAppIntegrationService>;
  let queueStatusService: jest.Mocked<QueueStatusService>;
  let featureFlagsService: jest.Mocked<FeatureFlagsService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        DiagnosticsService,
        {
          provide: HealthCheckService,
          useValue: { getChecks: jest.fn(), getCacheStatus: jest.fn() },
        },
        { provide: WhatsAppIntegrationService, useValue: { getSummary: jest.fn() } },
        { provide: QueueStatusService, useValue: { getStatus: jest.fn() } },
        { provide: FeatureFlagsService, useValue: { list: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === "observability") {
                return { buildVersion: "1.0.0", gitCommit: "abc123" };
              }
              if (key === "env") {
                return "test";
              }
              throw new Error(`Unexpected config key: ${key}`);
            }),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(DiagnosticsService);
    healthCheckService = moduleRef.get(HealthCheckService);
    whatsAppIntegrationService = moduleRef.get(WhatsAppIntegrationService);
    queueStatusService = moduleRef.get(QueueStatusService);
    featureFlagsService = moduleRef.get(FeatureFlagsService);

    healthCheckService.getCacheStatus.mockResolvedValue({
      connected: true,
      usedMemoryBytes: 1024,
    });
    queueStatusService.getStatus.mockResolvedValue([
      { name: "email", waiting: 0, active: 0, completed: 10, failed: 0, delayed: 0, workers: 1 },
      {
        name: "data-export",
        waiting: 1,
        active: 0,
        completed: 5,
        failed: 0,
        delayed: 0,
        workers: 1,
      },
    ]);
    featureFlagsService.list.mockResolvedValue([]);
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

  it("composes build metadata, environment, feature flags, queue status, cache status, and active worker count", async () => {
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

    expect(result.buildVersion).toBe("1.0.0");
    expect(result.gitCommit).toBe("abc123");
    expect(result.environment).toBe("test");
    expect(result.featureFlags).toEqual([]);
    expect(result.queues).toHaveLength(2);
    expect(result.cache).toEqual({ connected: true, usedMemoryBytes: 1024 });
    expect(result.activeWorkers).toBe(2);
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
