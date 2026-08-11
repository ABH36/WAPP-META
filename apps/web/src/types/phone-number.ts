/** FRD-001 Volume-4 §4.6 — mirrors `apps/api`'s `PhoneNumberSummary`. Needed only as the `phoneNumberId` picker for Create Broadcast/Campaign; no dedicated phone-number management UI is built this volume. */
export type QualityRating = "GREEN" | "YELLOW" | "RED" | "UNKNOWN";

export interface PhoneNumberSummary {
  id: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  verifiedName: string | null;
  qualityRating: QualityRating;
  messagingLimitTier: string | null;
}
