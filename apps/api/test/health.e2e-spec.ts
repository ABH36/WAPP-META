import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import type { Server } from "http";
import request from "supertest";
import type { ApiSuccessResponse } from "@wapp/shared-types";
import { AppModule } from "../src/app.module.js";

interface HealthData {
  status: "ok" | "degraded";
  database: string;
  timestamp: string;
}

describe("Health (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix("api");
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/health returns the standard success envelope", async () => {
    const response = await request(app.getHttpServer() as Server).get("/api/health");
    const body = response.body as ApiSuccessResponse<HealthData>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty("status");
    expect(body.data).toHaveProperty("database");
  });
});
