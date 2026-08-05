import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  TemplateStatusChangedPayload,
  TemplateSubmittedPayload,
} from "../../../common/events/domain-events.js";
import { TokenEncryptionService } from "../../../common/security/token-encryption.service.js";
import { MetaApiClient } from "./meta-api-client.service.js";
import { WhatsAppConnectionRepository } from "../repositories/whatsapp-connection.repository.js";
import { TemplateRepository } from "../repositories/template.repository.js";
import { toTemplateSummary } from "../mappers/communication.mapper.js";
import type { TemplateSummary } from "../communication.types.js";
import type { CreateTemplateDto } from "../dto/create-template.dto.js";
import { TemplateStatus } from "../schemas/template.schema.js";

/** Maps Meta's own template status strings onto our enum — same literal values today, kept as an explicit map rather than a cast so a future Meta-side status we don't recognize fails loudly instead of silently mistyping. */
const META_STATUS_MAP: Record<string, TemplateStatus> = {
  PENDING: TemplateStatus.PENDING,
  APPROVED: TemplateStatus.APPROVED,
  REJECTED: TemplateStatus.REJECTED,
  PAUSED: TemplateStatus.PAUSED,
  DISABLED: TemplateStatus.DISABLED,
};

/**
 * Template lifecycle (PRD-003 Part 3, BDC-010 — in-platform creation +
 * submission is Phase-1 scope, not just Meta-sync). See
 * docs/COMM-TEMPLATE-LIFECYCLE.md.
 */
@Injectable()
export class TemplateService {
  constructor(
    private readonly templateRepository: TemplateRepository,
    private readonly connectionRepository: WhatsAppConnectionRepository,
    private readonly tokenEncryption: TokenEncryptionService,
    private readonly metaApiClient: MetaApiClient,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(
    workspaceId: string,
    createdBy: string,
    dto: CreateTemplateDto,
  ): Promise<TemplateSummary> {
    const bodyComponent = dto.components.find((c) => c.type === "BODY");
    if (!bodyComponent?.text) {
      throw new BadRequestException("A template must include a BODY component with text");
    }

    const template = await this.templateRepository.create({
      workspaceId,
      name: dto.name,
      category: dto.category,
      language: dto.language,
      components: dto.components,
      createdBy,
    });
    return toTemplateSummary(template);
  }

  async list(workspaceId: string): Promise<TemplateSummary[]> {
    const templates = await this.templateRepository.findByWorkspace(workspaceId);
    return templates.map(toTemplateSummary);
  }

  async getById(workspaceId: string, id: string): Promise<TemplateSummary> {
    const template = await this.findOrThrow(workspaceId, id);
    return toTemplateSummary(template);
  }

  /** Submits a DRAFT template to Meta for review — moves it to PENDING. */
  async submit(workspaceId: string, id: string, actorId: string): Promise<TemplateSummary> {
    const template = await this.findOrThrow(workspaceId, id);
    if (template.status !== TemplateStatus.DRAFT) {
      throw new BadRequestException(
        `Only a DRAFT template can be submitted (current status: ${template.status})`,
      );
    }

    const connection = await this.connectionRepository.findByWorkspace(workspaceId);
    if (!connection) {
      throw new ForbiddenException("No WhatsApp connection for this workspace");
    }
    const accessToken = this.tokenEncryption.decrypt(connection.accessTokenEncrypted);

    const { metaTemplateId, status } = await this.metaApiClient.createTemplate(
      connection.wabaId,
      accessToken,
      {
        name: template.name,
        category: template.category,
        language: template.language,
        components: template.components,
      },
    );

    const updated = await this.templateRepository.markSubmitted(id, metaTemplateId);
    if (!updated) {
      throw new NotFoundException("Template not found");
    }

    this.eventEmitter.emit(DomainEvent.TEMPLATE_SUBMITTED, {
      workspaceId,
      templateId: id,
      metaTemplateId,
      submittedBy: actorId,
      occurredAt: new Date().toISOString(),
    } satisfies TemplateSubmittedPayload);

    // Meta can (rarely) approve trivially-compliant templates synchronously;
    // reflect that immediately rather than waiting for the next sync.
    if (status && status !== "PENDING") {
      const mapped = META_STATUS_MAP[status];
      if (mapped) {
        await this.templateRepository.updateStatus(id, mapped);
      }
    }

    return toTemplateSummary(
      (await this.templateRepository.findByIdForWorkspace(workspaceId, id))!,
    );
  }

  /**
   * Pulls the current template list + review status from Meta and upserts
   * local records. This is a pull-based sync, not a webhook subscription —
   * Meta's real-time `message_template_status_update` webhook event exists
   * but isn't wired up in this slice (see docs/COMM-TEMPLATE-LIFECYCLE.md's
   * "known gap" note). Call this endpoint to pick up review outcomes.
   */
  async syncFromMeta(workspaceId: string): Promise<TemplateSummary[]> {
    const connection = await this.connectionRepository.findByWorkspace(workspaceId);
    if (!connection) {
      throw new ForbiddenException("No WhatsApp connection for this workspace");
    }
    const accessToken = this.tokenEncryption.decrypt(connection.accessTokenEncrypted);

    const metaTemplates = await this.metaApiClient.listTemplates(connection.wabaId, accessToken);

    const results: TemplateSummary[] = [];
    for (const metaTemplate of metaTemplates) {
      const existing = await this.templateRepository.findByMetaTemplateId(
        workspaceId,
        metaTemplate.metaTemplateId,
      );
      const previousStatus = existing?.status ?? null;
      const mappedStatus = META_STATUS_MAP[metaTemplate.status] ?? TemplateStatus.PENDING;

      const updated = await this.templateRepository.upsertFromMetaSync(
        workspaceId,
        metaTemplate.metaTemplateId,
        {
          name: metaTemplate.name,
          category: metaTemplate.category as never,
          language: metaTemplate.language,
          components: metaTemplate.components,
          status: mappedStatus,
          rejectionReason: metaTemplate.rejectedReason,
          createdBy: "META_SYNC",
        },
      );

      if (previousStatus && previousStatus !== mappedStatus) {
        this.eventEmitter.emit(DomainEvent.TEMPLATE_STATUS_CHANGED, {
          workspaceId,
          templateId: updated._id.toString(),
          previousStatus,
          newStatus: mappedStatus,
          occurredAt: new Date().toISOString(),
        } satisfies TemplateStatusChangedPayload);
      }

      results.push(toTemplateSummary(updated));
    }
    return results;
  }

  private async findOrThrow(workspaceId: string, id: string) {
    const template = await this.templateRepository.findByIdForWorkspace(workspaceId, id);
    if (!template) {
      throw new NotFoundException("Template not found");
    }
    return template;
  }
}
