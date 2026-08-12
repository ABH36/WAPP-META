import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UsageProgress } from "./usage-progress";

describe("UsageProgress", () => {
  it("shows 'No limit set' when percentage is null", () => {
    render(<UsageProgress percentage={null} />);
    expect(screen.getByText("No limit set")).toBeInTheDocument();
  });

  it("shows a locked message when locked", () => {
    render(<UsageProgress percentage={100} locked />);
    expect(screen.getByText("Locked — limit reached")).toBeInTheDocument();
  });

  it("does not show a locked message when not locked", () => {
    render(<UsageProgress percentage={40} />);
    expect(screen.queryByText("Locked — limit reached")).not.toBeInTheDocument();
  });
});
