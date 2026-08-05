# COMM-001 — WABA Token Encryption & Webhook Security

**Status:** Accepted
**Type:** Technical security decision
**Date:** 2026-08-05
**Implemented in:** `apps/api/src/common/security/token-encryption.service.ts`, `apps/api/src/modules/communication/services/webhook.service.ts`

## Context

PRD-003 Part 1 requires WAPP to hold a System User access token per connected customer WABA (D004 — WAPP is a Tech Provider; the token is the customer's, scoped to their WABA, but WAPP must store it to make calls on their behalf) and to receive Meta webhook events over a public, unauthenticated HTTP endpoint. Neither had a prior TAD-001 clause to point to — both decisions are recorded here.

## Decisions

**Token storage — AES-256-GCM, not a KMS/secrets-manager integration.** The WABA access token is encrypted at rest with a symmetric key (`TOKEN_ENCRYPTION_KEY`, 32 random bytes, env var) using authenticated encryption (GCM) — a tampered ciphertext fails to decrypt rather than silently returning garbage. Rejected a cloud KMS (AWS/GCP) integration for Phase-1: no cloud provider is fixed yet for deployment (Docker Compose today), and a symmetric env-var key is consistent with how every other secret in this codebase is currently handled (JWT secrets, App Secret itself). **Consequence flagged explicitly:** rotating `TOKEN_ENCRYPTION_KEY` invalidates every stored token — the only recovery is each workspace reconnecting their WABA. Revisit if/when a proper secrets manager is adopted for deployment.

**Webhook signature verification — raw-body HMAC, not payload-shape trust.** Every POST to `/webhooks/whatsapp` is verified against `X-Hub-Signature-256` (HMAC-SHA256 over the exact raw request bytes, keyed by the Meta App Secret) before any processing — computed via `NestFactory`'s `rawBody: true` option (preserves `request.rawBody` alongside normal JSON parsing) rather than re-serializing the parsed body, which can silently mismatch on key order/whitespace even for byte-identical logical content. An invalid signature is rejected with 403 before the payload is even queued.

**Webhook processing is queued (BullMQ), not synchronous.** The controller verifies the signature and immediately enqueues; `WebhookProcessingProcessor` does the actual Contact/Message writes off the request path. Per TAD-001 Engineering Standards ("heavy ops must be queue-based, never block the main request") and the practical concern that a slow Mongo write on the request path risks Meta treating the webhook as failed/timed-out and retrying unnecessarily.

**Idempotency — Meta's own message ID, not a separate dedup table.** `Message.waMessageId` is unique-indexed; a redelivered webhook for an already-recorded message is detected and skipped (checked before any write). No separate "processed webhook events" ledger — the message record itself is the dedup record.

## What's NOT verified live

Everything above except the webhook receiver has only been unit-tested against a mocked `MetaApiClient` — the WABA connect flow (Embedded Signup code exchange, webhook subscription, phone number sync) and outbound message sending both call the real Meta Graph API, and verifying them live requires either a completed Embedded Signup (no frontend UI exists yet) or a separately-issued test access token neither of which is available this session. The webhook receiver itself (subscription handshake, signature verification, async inbound-message processing) **is** verified live end-to-end in `apps/api/test/communication.e2e-spec.ts`, using the real `META_APP_SECRET`/`META_WEBHOOK_VERIFY_TOKEN` against live Docker Mongo/Redis. Flagged here so this isn't mistaken for full live coverage.

## Future Work

- Revisit key management (KMS) once a deployment target is fixed.
- A `POST /webhooks/whatsapp` load test to confirm the queue-based design actually keeps Meta's delivery timeout comfortably clear under realistic volume — not attempted in Phase-1.
