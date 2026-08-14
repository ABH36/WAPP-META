import { CorrelationContextService } from "./correlation-context.service.js";
import { requestContextStorage } from "./request-context.storage.js";

describe("CorrelationContextService", () => {
  let service: CorrelationContextService;

  beforeEach(() => {
    service = new CorrelationContextService();
  });

  it("getCorrelationId returns undefined outside any run()", () => {
    expect(service.getCorrelationId()).toBeUndefined();
  });

  it("run() seeds the store so getCorrelationId() resolves it inside the callback", () => {
    service.run("corr-1", () => {
      expect(service.getCorrelationId()).toBe("corr-1");
    });
  });

  it("getCorrelationId returns undefined again once the callback returns", () => {
    service.run("corr-1", () => undefined);
    expect(service.getCorrelationId()).toBeUndefined();
  });

  it("getOrCreateCorrelationId reuses the active correlation ID when one exists", () => {
    service.run("corr-1", () => {
      expect(service.getOrCreateCorrelationId()).toBe("corr-1");
    });
  });

  it("getOrCreateCorrelationId generates a fresh UUID when called outside any tracked context", () => {
    const id = service.getOrCreateCorrelationId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("setUserContext mutates the live store in place, visible to the rest of the same run()", () => {
    service.run("corr-1", () => {
      service.setUserContext({ userId: "user-1", workspaceId: "workspace-1" });
      const store = requestContextStorage.getStore();
      expect(store).toEqual({
        correlationId: "corr-1",
        userId: "user-1",
        workspaceId: "workspace-1",
      });
    });
  });

  it("setUserContext is a silent no-op outside any tracked context", () => {
    expect(() => service.setUserContext({ userId: "user-1" })).not.toThrow();
  });
});
