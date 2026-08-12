import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SupportTicketCard } from "./support-ticket-card";

describe("SupportTicketCard", () => {
  it("renders title, workspace, category, priority, status", () => {
    render(
      <SupportTicketCard
        title="Cannot access dashboard"
        workspaceLabel="Acme Inc"
        category="TECHNICAL"
        priority="HIGH"
        status="OPEN"
        assignedOperator={null}
      />,
    );
    expect(screen.getByText("Cannot access dashboard")).toBeInTheDocument();
    expect(screen.getByText("Acme Inc")).toBeInTheDocument();
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });

  it("shows the assigned operator when set", () => {
    render(
      <SupportTicketCard
        title="Billing question"
        workspaceLabel="Acme Inc"
        category="BILLING"
        priority="LOW"
        status="IN_PROGRESS"
        assignedOperator="Sam"
      />,
    );
    expect(screen.getByText("Assigned to Sam")).toBeInTheDocument();
  });
});
