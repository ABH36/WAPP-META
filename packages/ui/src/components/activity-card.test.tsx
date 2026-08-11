import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivityCard } from "./activity-card";

describe("ActivityCard", () => {
  it("renders title and timestamp", () => {
    render(
      <ActivityCard type="CALL" title="Follow-up call" timestamp="2026-08-11T10:00:00.000Z" />,
    );
    expect(screen.getByText("Follow-up call")).toBeInTheDocument();
  });

  it("renders a status badge when given", () => {
    render(
      <ActivityCard
        type="TASK"
        title="Send proposal"
        statusLabel="COMPLETED"
        timestamp="2026-08-11T10:00:00.000Z"
      />,
    );
    expect(screen.getByText("COMPLETED")).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    render(
      <ActivityCard
        type="NOTE"
        title="Note text"
        timestamp="2026-08-11T10:00:00.000Z"
        onClick={onClick}
      />,
    );
    await userEvent.click(screen.getByText("Note text"));
    expect(onClick).toHaveBeenCalled();
  });
});
