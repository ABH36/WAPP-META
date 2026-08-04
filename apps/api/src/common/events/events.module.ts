import { Global, Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { DomainEventLoggerListener } from "./domain-event-logger.listener.js";

/**
 * Domain event publish/subscribe boundary (Architecture Review engineering
 * recommendation, Phase-3 review) — business modules inject `EventEmitter2`
 * (from `@nestjs/event-emitter`) and emit events from `domain-events.ts`;
 * this module is where future consumers (Global Audit, Notifications)
 * register their own listeners, without the publisher ever changing.
 *
 * `wildcard: true` lets a future listener subscribe to `workspace.*` or
 * `team.*` instead of every individual event name.
 */
@Global()
@Module({
  imports: [EventEmitterModule.forRoot({ wildcard: true })],
  providers: [DomainEventLoggerListener],
  exports: [EventEmitterModule],
})
export class EventsModule {}
