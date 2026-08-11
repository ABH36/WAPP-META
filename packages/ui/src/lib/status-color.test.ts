import { describe, it, expect } from "vitest";
import {
  WorkspaceStatus,
  LeadStatus,
  DealStage,
  PaymentStatus,
  CustomerStatus,
} from "@wapp/shared-types";
import { getStatusColor } from "./status-color";

describe("getStatusColor", () => {
  it("maps positive business states to success", () => {
    expect(getStatusColor(WorkspaceStatus.ACTIVE)).toBe("success");
    expect(getStatusColor(LeadStatus.WON)).toBe("success");
    expect(getStatusColor(DealStage.WON)).toBe("success");
    expect(getStatusColor(PaymentStatus.PAID)).toBe("success");
  });

  it("maps attention states to warning", () => {
    expect(getStatusColor(WorkspaceStatus.TRIAL)).toBe("warning");
    expect(getStatusColor(PaymentStatus.PENDING)).toBe("warning");
  });

  it("maps negative states to danger", () => {
    expect(getStatusColor(WorkspaceStatus.SUSPENDED)).toBe("danger");
    expect(getStatusColor(LeadStatus.LOST)).toBe("danger");
    expect(getStatusColor(PaymentStatus.FAILED)).toBe("danger");
  });

  it("maps inactive/archived states to neutral", () => {
    expect(getStatusColor(WorkspaceStatus.CANCELLED)).toBe("neutral");
    expect(getStatusColor(LeadStatus.UNQUALIFIED)).toBe("neutral");
  });

  it("defaults unmapped values to info", () => {
    expect(getStatusColor("SOME_UNMAPPED_STATUS")).toBe("info");
  });

  it("maps Communication's real Conversation status values (FRD-001 Volume-4)", () => {
    expect(getStatusColor("RESOLVED")).toBe("success");
    expect(getStatusColor("PENDING")).toBe("warning");
    expect(getStatusColor("SPAM")).toBe("danger");
    expect(getStatusColor("CLOSED")).toBe("neutral");
    expect(getStatusColor("NEW")).toBe("info");
    expect(getStatusColor("OPEN")).toBe("info");
  });

  it("maps Communication's real Broadcast/Campaign status values", () => {
    expect(getStatusColor("COMPLETED")).toBe("success");
    expect(getStatusColor("RUNNING")).toBe("warning");
    expect(getStatusColor("SCHEDULED")).toBe("warning");
    expect(getStatusColor("FAILED")).toBe("danger");
    expect(getStatusColor("CANCELLED")).toBe("neutral");
    // "ACTIVE" is shared with WorkspaceStatus.ACTIVE (already "success") —
    // Campaign's ACTIVE reuses that bucket rather than special-casing a
    // cross-domain string collision.
    expect(getStatusColor("ACTIVE")).toBe("success");
  });

  it("maps Communication's real Template status values", () => {
    expect(getStatusColor("APPROVED")).toBe("success");
    expect(getStatusColor("REJECTED")).toBe("danger");
    expect(getStatusColor("PAUSED")).toBe("warning");
    expect(getStatusColor("DISABLED")).toBe("neutral");
    expect(getStatusColor("DRAFT")).toBe("info");
  });

  it("maps CRM's real Lead/Deal/Customer status values (FRD-001 Volume-5)", () => {
    expect(getStatusColor(LeadStatus.UNQUALIFIED)).toBe("neutral");
    expect(getStatusColor(DealStage.OPEN)).toBe("info");
    expect(getStatusColor(DealStage.QUALIFICATION)).toBe("info");
    expect(getStatusColor(CustomerStatus.BLOCKED)).toBe("warning");
    // ARCHIVED is shared with ConversationStatus.ARCHIVED (already "neutral").
    expect(getStatusColor(CustomerStatus.ARCHIVED)).toBe("neutral");
    // ACTIVE is shared with WorkspaceStatus.ACTIVE (already "success").
    expect(getStatusColor(CustomerStatus.ACTIVE)).toBe("success");
  });
});
