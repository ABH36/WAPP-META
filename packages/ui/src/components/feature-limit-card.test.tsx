import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeatureLimitCard } from "./feature-limit-card";

describe("FeatureLimitCard", () => {
  it("renders label and count/limit", () => {
    render(<FeatureLimitCard label="Team Members" count={3} limit={10} percentage={30} />);
    expect(screen.getByText("Team Members")).toBeInTheDocument();
    expect(screen.getByText("3 / 10")).toBeInTheDocument();
  });

  it("renders count alone when limit is null", () => {
    render(<FeatureLimitCard label="Customers" count={50} limit={null} percentage={null} />);
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("No limit set")).toBeInTheDocument();
  });
});
