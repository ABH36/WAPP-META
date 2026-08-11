import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProbabilityBadge } from "./probability-badge";

describe("ProbabilityBadge", () => {
  it("renders the percentage", () => {
    render(<ProbabilityBadge probability={45} />);
    expect(screen.getByText("45%")).toBeInTheDocument();
  });

  it("colors low probability as danger", () => {
    render(<ProbabilityBadge probability={10} />);
    expect(screen.getByText("10%").className).toContain("bg-danger-50");
  });

  it("colors mid probability as warning", () => {
    render(<ProbabilityBadge probability={50} />);
    expect(screen.getByText("50%").className).toContain("bg-warning-50");
  });

  it("colors high probability as success", () => {
    render(<ProbabilityBadge probability={90} />);
    expect(screen.getByText("90%").className).toContain("bg-success-50");
  });
});
