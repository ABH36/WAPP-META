import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HealthStatusCard } from "./health-status-card";

describe("HealthStatusCard", () => {
  it("renders the check name and an UP status", () => {
    render(<HealthStatusCard name="database" status="UP" />);
    expect(screen.getByText("database")).toBeInTheDocument();
    expect(screen.getByText("UP")).toBeInTheDocument();
  });

  it("renders a DOWN status", () => {
    render(<HealthStatusCard name="redis" status="DOWN" />);
    expect(screen.getByText("DOWN")).toBeInTheDocument();
  });
});
