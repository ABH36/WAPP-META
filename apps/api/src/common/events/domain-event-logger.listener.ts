import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { DomainEvent } from "./domain-events.js";

/**
 * Temporary consumer — proves the publish side actually fires (visible in
 * structured logs) until the real consumers (Global Audit Center, per
 * PRD-007; Notification module) exist. Delete this listener once either of
 * those modules subscribes for real; it is not itself the audit trail or a
 * notification delivery mechanism, just a placeholder that keeps the
 * publish/subscribe boundary honest in the meantime.
 *
 * One handler per event (rather than a "**" wildcard) — EventEmitter2's
 * wildcard listeners recover the matched event name via `this.event`, which
 * depends on `this`-binding semantics that don't reliably survive being
 * wrapped as a NestJS class method. Explicit per-event handlers avoid that
 * uncertainty entirely.
 */
@Injectable()
export class DomainEventLoggerListener {
  private readonly logger = new Logger("DomainEvent");

  @OnEvent(DomainEvent.WORKSPACE_CREATED)
  onWorkspaceCreated(payload: unknown): void {
    this.log(DomainEvent.WORKSPACE_CREATED, payload);
  }

  @OnEvent(DomainEvent.WORKSPACE_UPDATED)
  onWorkspaceUpdated(payload: unknown): void {
    this.log(DomainEvent.WORKSPACE_UPDATED, payload);
  }

  @OnEvent(DomainEvent.TEAM_MEMBER_INVITED)
  onMemberInvited(payload: unknown): void {
    this.log(DomainEvent.TEAM_MEMBER_INVITED, payload);
  }

  @OnEvent(DomainEvent.TEAM_MEMBER_ACCEPTED)
  onMemberAccepted(payload: unknown): void {
    this.log(DomainEvent.TEAM_MEMBER_ACCEPTED, payload);
  }

  @OnEvent(DomainEvent.TEAM_MEMBER_SUSPENDED)
  onMemberSuspended(payload: unknown): void {
    this.log(DomainEvent.TEAM_MEMBER_SUSPENDED, payload);
  }

  @OnEvent(DomainEvent.TEAM_MEMBER_REACTIVATED)
  onMemberReactivated(payload: unknown): void {
    this.log(DomainEvent.TEAM_MEMBER_REACTIVATED, payload);
  }

  @OnEvent(DomainEvent.TEAM_OWNERSHIP_TRANSFERRED)
  onOwnershipTransferred(payload: unknown): void {
    this.log(DomainEvent.TEAM_OWNERSHIP_TRANSFERRED, payload);
  }

  private log(event: string, payload: unknown): void {
    this.logger.log(`domain event published: ${event} ${JSON.stringify(payload)}`);
  }
}
