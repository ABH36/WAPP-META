import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BroadcastCard } from "./broadcast-card";

describe("BroadcastCard", () => {
  it("renders name, status, and send progress", () => {
    render(<BroadcastCard name="Diwali Sale" status="RUNNING" sentCount={40} totalCount={100} />);
    expect(screen.getByText("Diwali Sale")).toBeInTheDocument();
    expect(screen.getByText("RUNNING")).toBeInTheDocument();
    expect(screen.getByText(/Send progress: 40\/100/)).toBeInTheDocument();
  });

  it("shows 'Not scheduled' when scheduledAt is absent", () => {
    render(<BroadcastCard name="Draft blast" status="DRAFT" />);
    expect(screen.getByText(/Not scheduled/)).toBeInTheDocument();
  });
});
