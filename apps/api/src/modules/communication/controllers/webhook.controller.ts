import {
  Controller,
  Get,
  Post,
  Query,
  Headers,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Version,
  VERSION_NEUTRAL,
  type RawBodyRequest,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import type { Request, Response } from "express";
import { Public } from "../../../common/decorators/public.decorator.js";
import { WebhookService, InvalidWebhookSignatureException } from "../services/webhook.service.js";
import { WEBHOOK_PROCESSING_QUEUE } from "../queue/webhook-processing.constants.js";

/**
 * Meta calls this endpoint directly — no JWT, no API versioning (a webhook
 * URL registered in Meta's App Dashboard must stay stable regardless of our
 * own API version bumps, same reasoning as HealthController's
 * VERSION_NEUTRAL). Public but not unauthenticated in any meaningful sense:
 * the GET handshake requires knowing the verify token, and every POST is
 * signature-checked before anything is trusted (see WebhookService).
 */
@Controller("webhooks/whatsapp")
export class WebhookController {
  constructor(
    private readonly webhookService: WebhookService,
    @InjectQueue(WEBHOOK_PROCESSING_QUEUE) private readonly queue: Queue,
  ) {}

  @Public()
  @Version(VERSION_NEUTRAL)
  @Get()
  verifySubscription(
    @Query("hub.mode") mode: string | undefined,
    @Query("hub.verify_token") verifyToken: string | undefined,
    @Query("hub.challenge") challenge: string | undefined,
    @Res() res: Response,
  ): void {
    if (this.webhookService.verifySubscription(mode, verifyToken)) {
      // Meta requires the *exact* challenge string back, as plain text —
      // not the standard JSON envelope. @Res() takes full manual control of
      // the response specifically so this bypasses ResponseInterceptor.
      res.status(HttpStatus.OK).send(challenge);
      return;
    }
    res.status(HttpStatus.FORBIDDEN).send();
  }

  @Public()
  @Version(VERSION_NEUTRAL)
  @HttpCode(HttpStatus.OK)
  @Post()
  async receiveEvent(
    @Req() request: RawBodyRequest<Request>,
    @Headers("x-hub-signature-256") signature: string | undefined,
  ): Promise<{ received: true }> {
    const rawBody = request.rawBody;
    if (!rawBody || !this.webhookService.verifySignature(rawBody, signature)) {
      throw new InvalidWebhookSignatureException();
    }

    // Ack fast — actual processing happens off the request path (see
    // WebhookProcessingProcessor).
    await this.queue.add("process-event", request.body as unknown, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
    });

    return { received: true };
  }
}
