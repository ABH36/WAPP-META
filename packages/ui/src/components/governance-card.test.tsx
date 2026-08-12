import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GovernanceCard } from "./governance-card";

describe("GovernanceCard", () => {
  it("renders the policy key and version when set", () => {
    render(
      <GovernanceCard
        policyKey="SESSION_TIMEOUT"
        isSet
        version={2}
        updatedBy="admin-1"
        updatedAt="2026-08-01T00:00:00.000Z"
      />,
    );
    expect(screen.getByText("SESSION_TIMEOUT")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText(/Last updated by admin-1/)).toBeInTheDocument();
  });

  it("shows an unset state when the policy has never been written", () => {
    render(
      <GovernanceCard
        policyKey="DEFAULT_RETENTION"
        isSet={false}
        version={0}
        updatedBy={null}
        updatedAt={null}
      />,
    );
    expect(screen.getByText("Unset")).toBeInTheDocument();
    expect(screen.getByText("No value has been set yet")).toBeInTheDocument();
  });
});
