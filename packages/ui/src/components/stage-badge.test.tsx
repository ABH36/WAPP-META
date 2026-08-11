import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StageBadge } from "./stage-badge";

describe("StageBadge", () => {
  it("renders the raw value as its label by default", () => {
    render(<StageBadge value="WON" />);
    expect(screen.getByText("WON")).toBeInTheDocument();
    expect(screen.getByText("WON").className).toContain("bg-success-50");
  });

  it("renders a custom label when given one", () => {
    render(<StageBadge value="LOST" label="Deal Lost" />);
    expect(screen.getByText("Deal Lost")).toBeInTheDocument();
  });
});
