import { describe, it, expect } from "vitest";
import { DealStage, LeadStatus } from "@wapp/shared-types";
import { getValidDealTransitions, getValidLeadTransitions } from "./crm-transitions";

describe("getValidLeadTransitions", () => {
  it("returns the real forward transitions for NEW", () => {
    expect(getValidLeadTransitions(LeadStatus.NEW)).toEqual([
      LeadStatus.CONTACTED,
      LeadStatus.LOST,
      LeadStatus.UNQUALIFIED,
    ]);
  });

  it("returns no transitions for terminal statuses", () => {
    expect(getValidLeadTransitions(LeadStatus.WON)).toEqual([]);
    expect(getValidLeadTransitions(LeadStatus.LOST)).toEqual([]);
    expect(getValidLeadTransitions(LeadStatus.UNQUALIFIED)).toEqual([]);
  });

  it("allows NEGOTIATION to reach WON", () => {
    expect(getValidLeadTransitions(LeadStatus.NEGOTIATION)).toContain(LeadStatus.WON);
  });
});

describe("getValidDealTransitions", () => {
  it("returns the real forward transitions for OPEN", () => {
    expect(getValidDealTransitions(DealStage.OPEN)).toEqual([
      DealStage.QUALIFICATION,
      DealStage.LOST,
    ]);
  });

  it("returns no transitions for terminal stages (reopen is a separate dedicated route)", () => {
    expect(getValidDealTransitions(DealStage.WON)).toEqual([]);
    expect(getValidDealTransitions(DealStage.LOST)).toEqual([]);
  });
});
