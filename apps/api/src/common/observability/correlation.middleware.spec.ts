import type { Request, Response } from "express";
import { CorrelationMiddleware } from "./correlation.middleware.js";
import { CorrelationContextService } from "./correlation-context.service.js";

describe("CorrelationMiddleware", () => {
  let middleware: CorrelationMiddleware;
  let correlationContext: CorrelationContextService;
  let setHeader: jest.Mock;

  beforeEach(() => {
    correlationContext = new CorrelationContextService();
    middleware = new CorrelationMiddleware(correlationContext);
    setHeader = jest.fn();
  });

  function fakeRequest(headers: Record<string, string | string[] | undefined>): Request {
    return { headers } as unknown as Request;
  }

  function fakeResponse(): Response {
    return { setHeader } as unknown as Response;
  }

  it("generates a fresh correlation ID when the request has none", () => {
    const next = jest.fn(() => {
      expect(correlationContext.getCorrelationId()).toMatch(/^[0-9a-f-]{36}$/);
    });

    middleware.use(fakeRequest({}), fakeResponse(), next);

    expect(next).toHaveBeenCalled();
    expect(setHeader).toHaveBeenCalledWith(
      "x-correlation-id",
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    );
  });

  it("propagates an existing X-Correlation-ID header instead of generating a new one", () => {
    const next = jest.fn(() => {
      expect(correlationContext.getCorrelationId()).toBe("incoming-id");
    });

    middleware.use(fakeRequest({ "x-correlation-id": "incoming-id" }), fakeResponse(), next);

    expect(setHeader).toHaveBeenCalledWith("x-correlation-id", "incoming-id");
  });

  it("uses the first value when the header arrives duplicated", () => {
    const next = jest.fn();

    middleware.use(
      fakeRequest({ "x-correlation-id": ["first-id", "second-id"] }),
      fakeResponse(),
      next,
    );

    expect(setHeader).toHaveBeenCalledWith("x-correlation-id", "first-id");
  });

  it("the correlation ID is no longer active once next() (and the request) has completed", () => {
    let idDuringRequest: string | undefined;
    const next = jest.fn(() => {
      idDuringRequest = correlationContext.getCorrelationId();
    });

    middleware.use(fakeRequest({ "x-correlation-id": "incoming-id" }), fakeResponse(), next);

    expect(idDuringRequest).toBe("incoming-id");
    expect(correlationContext.getCorrelationId()).toBeUndefined();
  });
});
