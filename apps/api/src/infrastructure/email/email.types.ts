import type { JobContext } from "../../common/observability/job-context.util.js";

/**
 * Generic email send job. Business modules (Identity's verification email,
 * Billing's invoice receipt, etc.) construct this and hand it to EmailService —
 * they never touch Resend or BullMQ directly. Template content is the
 * business module's responsibility (per TAD-001 v1.2 Email Patch — this layer
 * only owns delivery, not template authorship).
 */
export interface SendEmailJob extends Partial<JobContext> {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** For observability only — which business flow triggered this send (e.g. "email-verification"). */
  category: string;
}
