import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConversationCard } from "./conversation-card";

describe("ConversationCard", () => {
  it("renders contact name and status", () => {
    render(
      <ConversationCard
        contactName="Priya Sharma"
        contactPhoneNumber="+919876543210"
        status="OPEN"
        lastMessageAt="2026-08-11T10:00:00.000Z"
      />,
    );
    expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    expect(screen.getByText("OPEN")).toBeInTheDocument();
  });

  it("falls back to phone number when contact name is null", () => {
    render(
      <ConversationCard
        contactName={null}
        contactPhoneNumber="+919876543210"
        status="NEW"
        lastMessageAt="2026-08-11T10:00:00.000Z"
      />,
    );
    expect(screen.getByText("+919876543210")).toBeInTheDocument();
  });

  it("shows Unassigned when no assignee label is given", () => {
    render(
      <ConversationCard
        contactName="Priya Sharma"
        contactPhoneNumber="+919876543210"
        status="OPEN"
        lastMessageAt="2026-08-11T10:00:00.000Z"
      />,
    );
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    render(
      <ConversationCard
        contactName="Priya Sharma"
        contactPhoneNumber="+919876543210"
        status="OPEN"
        lastMessageAt="2026-08-11T10:00:00.000Z"
        onClick={onClick}
      />,
    );
    await userEvent.click(screen.getByText("Priya Sharma"));
    expect(onClick).toHaveBeenCalled();
  });
});
