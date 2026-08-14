import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { requestContextStorage, type RequestContextStore } from "./request-context.storage.js";

/**
 * PHD-001 Volume-2 §4.2 — the "shared context mechanism" the Architecture
 * Review named for propagating correlation IDs beyond HTTP. `CorrelationMiddleware`
 * seeds this for every HTTP request; `ObservableProcessor` (see
 * `observable-processor.base.ts`) seeds it for every BullMQ job, reading the
 * ID back out of `job.data.correlationId` where `withCorrelationId()` put it
 * at enqueue time. Any code running inside either — service methods,
 * repository calls, further enqueues — can read the current ID without it
 * being threaded through every function signature by hand.
 *
 * Wraps `requestContextStorage` (a plain module-level singleton, not itself
 * resolved through Nest DI) rather than owning a second, disconnected
 * `AsyncLocalStorage` instance — `logging.module.ts`'s `pinoHttp.mixin` hook
 * reads the exact same store directly, which is how correlation/user/
 * workspace context ends up on every Pino log line, not just HTTP access logs.
 */
@Injectable()
export class CorrelationContextService {
  run<R>(correlationId: string, callback: () => R): R {
    return requestContextStorage.run({ correlationId }, callback);
  }

  getCorrelationId(): string | undefined {
    return requestContextStorage.getStore()?.correlationId;
  }

  /**
   * The current request/job's correlation ID, or a freshly generated one if
   * called outside any tracked context — e.g. a self-triggered BullMQ
   * repeatable "sweep" job's own enqueue call in `onModuleInit()`, which has
   * no originating HTTP request to inherit from.
   */
  getOrCreateCorrelationId(): string {
    return this.getCorrelationId() ?? randomUUID();
  }

  /**
   * Mutates the *live* store object in place (a documented, supported
   * AsyncLocalStorage pattern — `getStore()` returns the real reference, not
   * a snapshot) so context discovered partway through a request — who the
   * authenticated user/workspace/platform user is, only known once a guard
   * has run — becomes visible to every log line for the rest of that same
   * request, not just ones after this call syntactically.
   */
  setUserContext(fields: Partial<Omit<RequestContextStore, "correlationId">>): void {
    const store = requestContextStorage.getStore();
    if (store) {
      Object.assign(store, fields);
    }
  }
}
