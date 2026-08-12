import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BreakGlassCard } from "./break-glass-card";

describe("BreakGlassCard", () => {
  it("renders workspace, requester, reason, duration, and status", () => {
    render(
      <BreakGlassCard
        workspaceLabel="Acme Inc"
        requestedBy="Sam"
        reason="Investigating a billing discrepancy reported by the customer"
        durationMinutes={60}
        status="REQUESTED"
        expiresAt={null}
      />,
    );
    expect(screen.getByText("Acme Inc")).toBeInTheDocument();
    expect(screen.getByText("Requested by Sam")).toBeInTheDocument();
    expect(screen.getByText("60 min")).toBeInTheDocument();
  });

  it("shows expiresAt when provided", () => {
    render(
      <BreakGlassCard
        workspaceLabel="Acme Inc"
        requestedBy="Sam"
        reason="Investigating"
        durationMinutes={60}
        status="ACTIVE"
        expiresAt="2026-08-01T12:00:00.000Z"
      />,
    );
    expect(screen.getByText(/Expires/)).toBeInTheDocument();
  });
});
