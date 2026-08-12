import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnnouncementCard } from "./announcement-card";

describe("AnnouncementCard", () => {
  it("renders title, message, and target type", () => {
    render(
      <AnnouncementCard
        title="Scheduled maintenance"
        message="The platform will be briefly unavailable this weekend."
        targetType="ALL"
        createdAt="2026-08-01T00:00:00.000Z"
      />,
    );
    expect(screen.getByText("Scheduled maintenance")).toBeInTheDocument();
    expect(screen.getByText(/briefly unavailable/)).toBeInTheDocument();
    expect(screen.getByText("ALL")).toBeInTheDocument();
  });
});
