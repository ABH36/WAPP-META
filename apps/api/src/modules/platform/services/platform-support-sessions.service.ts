import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import {
  ListSupportSessionsFilter,
  SupportSessionRepository,
} from "../repositories/support-session.repository.js";
import { toSupportSessionSummary } from "../mappers/platform.mapper.js";
import type { SupportSessionSummary } from "../platform.types.js";
import {
  SUPPORT_SESSION_MAX_DURATION_MINUTES,
  SupportSessionDocument,
  SupportSessionStatus,
} from "../schemas/support-session.schema.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  BreakGlassApprovedPayload,
  BreakGlassRequestedPayload,
  SupportSessionExpiredPayload,
  SupportSessionStartedPayload,
  SupportSessionTerminatedPayload,
} from "../../../common/events/domain-events.js";

export interface ListSupportSessionsResult {
  items: SupportSessionSummary[];
  total: number;
}

/**
 * PRD-007 Volume-3 §4.1/§4.2 — the Break-Glass request→approve→start→end
 * lifecycle. Architecture Review, 2026-08-10: approval is always required,
 * no policy-driven bypass exists this volume. Read-only cross-tenant
 * access only — this service never issues any tenant credential and never
 * calls into Workspace/CRM/Billing/Settings write paths. See
 * docs/ADR-PLAT-005-platform-support-break-glass-boundary.md.
 */
@Injectable()
export class PlatformSupportSessionsService {
  constructor(
    private readonly supportSessionRepository: SupportSessionRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** §4.1/§10/BR-001 — reason required, duration capped at 4 hours. */
  async request(
    workspaceId: string,
    reason: string,
    durationMinutes: number,
    actorId: string,
  ): Promise<SupportSessionSummary> {
    if (durationMinutes < 1 || durationMinutes > SUPPORT_SESSION_MAX_DURATION_MINUTES) {
      throw new BadRequestException(
        `Requested duration must be between 1 and ${SUPPORT_SESSION_MAX_DURATION_MINUTES} minutes`,
      );
    }
    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    const created = await this.supportSessionRepository.create({
      workspaceId,
      requestedBy: actorId,
      reason,
      durationMinutes,
    });

    const payload: BreakGlassRequestedPayload = {
      workspaceId,
      sessionId: created._id.toString(),
      reason,
      durationMinutes,
      actorId,
      occurredAt: new Date().toISOString(),
    };
    this.eventEmitter.emit(DomainEvent.BREAK_GLASS_REQUESTED, payload);

    return toSupportSessionSummary(created);
  }

  /** §4.1/BR-007 — approval is mandatory; there is no policy-driven auto-approve path this volume. */
  async approve(id: string, actorId: string): Promise<SupportSessionSummary> {
    const session = await this.findOrThrow(id);
    if (session.status !== SupportSessionStatus.REQUESTED) {
      throw new BadRequestException(`Cannot approve a request that is ${session.status}`);
    }

    const updated = await this.supportSessionRepository.approve(id, actorId);
    if (!updated) {
      throw new NotFoundException("Support Session not found");
    }

    const payload: BreakGlassApprovedPayload = {
      workspaceId: session.workspaceId,
      sessionId: id,
      actorId,
      occurredAt: new Date().toISOString(),
    };
    this.eventEmitter.emit(DomainEvent.BREAK_GLASS_APPROVED, payload);

    return toSupportSessionSummary(updated);
  }

  /** §4.2 — only an APPROVED request can start; `expiresAt` is computed now, not at request time, so time spent pending approval never counts against the access window. */
  async start(id: string, actorId: string): Promise<SupportSessionSummary> {
    const session = await this.findOrThrow(id);
    if (session.status !== SupportSessionStatus.APPROVED) {
      throw new BadRequestException(`Cannot start a session that is ${session.status}`);
    }

    const expiresAt = new Date(Date.now() + session.durationMinutes * 60_000);
    const updated = await this.supportSessionRepository.start(id, actorId, expiresAt);
    if (!updated) {
      throw new NotFoundException("Support Session not found");
    }

    const payload: SupportSessionStartedPayload = {
      workspaceId: session.workspaceId,
      sessionId: id,
      expiresAt: expiresAt.toISOString(),
      actorId,
      occurredAt: new Date().toISOString(),
    };
    this.eventEmitter.emit(DomainEvent.SUPPORT_SESSION_STARTED, payload);

    return toSupportSessionSummary(updated);
  }

  async end(id: string, reason: string | null, actorId: string): Promise<SupportSessionSummary> {
    const session = await this.findOrThrow(id);
    if (session.status !== SupportSessionStatus.ACTIVE) {
      throw new BadRequestException(`Cannot end a session that is ${session.status}`);
    }

    const terminationReason = reason ?? "Ended by operator";
    const updated = await this.supportSessionRepository.terminate(id, terminationReason);
    if (!updated) {
      throw new NotFoundException("Support Session not found");
    }

    const payload: SupportSessionTerminatedPayload = {
      workspaceId: session.workspaceId,
      sessionId: id,
      reason: terminationReason,
      actorId,
      occurredAt: new Date().toISOString(),
    };
    this.eventEmitter.emit(DomainEvent.SUPPORT_SESSION_TERMINATED, payload);

    return toSupportSessionSummary(updated);
  }

  async list(
    filter: ListSupportSessionsFilter,
    page: number,
    limit: number,
  ): Promise<ListSupportSessionsResult> {
    const { items, total } = await this.supportSessionRepository.list(filter, page, limit);
    return { items: items.map(toSupportSessionSummary), total };
  }

  /**
   * §11 — the real-time authorization gate every cross-tenant read
   * (Workspace Overview, Investigation Timeline) goes through. Throws
   * rather than returning a boolean so every gated controller fails the
   * same way (403) without repeating the check.
   */
  async ensureActiveAccess(workspaceId: string, platformUserId: string): Promise<void> {
    const session = await this.supportSessionRepository.findActiveForWorkspaceAndUser(
      workspaceId,
      platformUserId,
    );
    if (!session) {
      throw new ForbiddenException(
        "An active Support Session for this workspace is required to access this data",
      );
    }
  }

  /** SupportSessionLifecycleProcessor's sweep — the reporting/audit path, never the enforcement path (see ensureActiveAccess). */
  async expireOverdueSessions(now: Date): Promise<number> {
    const candidates = await this.supportSessionRepository.findExpiredActive(now);
    for (const session of candidates) {
      await this.expireOne(session);
    }
    return candidates.length;
  }

  private async expireOne(session: SupportSessionDocument): Promise<void> {
    const id = session._id.toString();
    await this.supportSessionRepository.expire(id);

    const payload: SupportSessionExpiredPayload = {
      workspaceId: session.workspaceId,
      sessionId: id,
      actorId: "system",
      occurredAt: new Date().toISOString(),
    };
    this.eventEmitter.emit(DomainEvent.SUPPORT_SESSION_EXPIRED, payload);
  }

  private async findOrThrow(id: string): Promise<SupportSessionDocument> {
    const session = await this.supportSessionRepository.findById(id);
    if (!session) {
      throw new NotFoundException("Support Session not found");
    }
    return session;
  }
}
