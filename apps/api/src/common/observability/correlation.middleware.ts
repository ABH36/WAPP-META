import { randomUUID } from "node:crypto";
import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { CorrelationContextService } from "./correlation-context.service.js";

const CORRELATION_HEADER = "x-correlation-id";

/**
 * PHD-001 Volume-2 §4.2 — generates or propagates `X-Correlation-ID` (mirrors
 * `logging.module.ts`'s existing `genReqId`, which already does this for
 * `X-Request-ID`), and seeds `CorrelationContextService` for the lifetime of
 * the request so every service/repository call — and anything a BullMQ job
 * enqueued from within this request later inherits via `withCorrelationId()`
 * — can read the same ID without it being threaded through every function
 * signature by hand.
 */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  constructor(private readonly correlationContext: CorrelationContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const existing = req.headers[CORRELATION_HEADER];
    const correlationId = (Array.isArray(existing) ? existing[0] : existing) ?? randomUUID();
    res.setHeader(CORRELATION_HEADER, correlationId);
    this.correlationContext.run(correlationId, next);
  }
}
