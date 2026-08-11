import { apiGet } from "../lib/api";
import type { PhoneNumberSummary } from "../types/phone-number";

/** FRD-001 Volume-4 §4.6 — `listPhoneNumbers()` only, used as the phone-number picker for Create Broadcast/Campaign. `GET /communication/whatsapp/phone-numbers` is gated `VIEW_WORKSPACE` (readable by every role). */
export const whatsappService = {
  listPhoneNumbers(): Promise<PhoneNumberSummary[]> {
    return apiGet("/communication/whatsapp/phone-numbers");
  },
};
