import { ForbiddenException } from "@nestjs/common";

/**
 * Thrown by ComplianceEngineService when a free-text (non-template) send is
 * attempted outside Meta's 24-hour customer service window. `403`, not a
 * Meta-originated error — this is WAPP's own proactive rejection, before any
 * Graph API call is made, per docs/COMM-COMPLIANCE-ENGINE.md.
 */
export class OutsideCustomerServiceWindowException extends ForbiddenException {
  constructor() {
    super(
      "This conversation is outside the 24-hour customer service window — only an approved template message can be sent",
    );
  }
}
