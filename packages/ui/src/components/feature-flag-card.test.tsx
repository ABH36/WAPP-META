import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeatureFlagCard } from "./feature-flag-card";

describe("FeatureFlagCard", () => {
  it("renders Enabled when true", () => {
    render(<FeatureFlagCard flagKey="CRM_MODULE" enabled={true} />);
    expect(screen.getByText("Enabled")).toBeInTheDocument();
  });

  it("renders Disabled when false", () => {
    render(<FeatureFlagCard flagKey="BETA_FEATURES" enabled={false} />);
    expect(screen.getByText("Disabled")).toBeInTheDocument();
  });

  it("renders Inherit when null, distinct from Disabled", () => {
    render(<FeatureFlagCard flagKey="AI_ASSISTANT" enabled={null} />);
    expect(screen.getByText("Inherit")).toBeInTheDocument();
    expect(screen.queryByText("Disabled")).not.toBeInTheDocument();
  });
});
