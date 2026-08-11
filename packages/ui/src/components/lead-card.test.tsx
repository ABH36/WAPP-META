import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LeadCard } from "./lead-card";

describe("LeadCard", () => {
  it("renders name, status, and source", () => {
    render(
      <LeadCard
        leadName="Acme Corp"
        status="NEW"
        source="WHATSAPP"
        createdAt="2026-08-11T10:00:00.000Z"
      />,
    );
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("NEW")).toBeInTheDocument();
  });

  it("shows Unassigned when no owner label is given", () => {
    render(
      <LeadCard
        leadName="Acme Corp"
        status="NEW"
        source="WHATSAPP"
        createdAt="2026-08-11T10:00:00.000Z"
      />,
    );
    expect(screen.getByText(/Unassigned/)).toBeInTheDocument();
  });

  it("shows a Converted marker when converted", () => {
    render(
      <LeadCard
        leadName="Acme Corp"
        status="WON"
        source="WHATSAPP"
        createdAt="2026-08-11T10:00:00.000Z"
        converted
      />,
    );
    expect(screen.getByText(/Converted/)).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    render(
      <LeadCard
        leadName="Acme Corp"
        status="NEW"
        source="WHATSAPP"
        createdAt="2026-08-11T10:00:00.000Z"
        onClick={onClick}
      />,
    );
    await userEvent.click(screen.getByText("Acme Corp"));
    expect(onClick).toHaveBeenCalled();
  });
});
