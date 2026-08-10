import { describe, it, expect } from "vitest";
import { WorkspaceStatus, LeadStatus, DealStage, PaymentStatus } from "@wapp/shared-types";
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
});
