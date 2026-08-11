import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Timeline, TimelineItem } from "./timeline";

describe("Timeline", () => {
  it("renders every TimelineItem's content", () => {
    render(
      <Timeline>
        <TimelineItem>First note</TimelineItem>
        <TimelineItem last>Second note</TimelineItem>
      </Timeline>,
    );
    expect(screen.getByText("First note")).toBeInTheDocument();
    expect(screen.getByText("Second note")).toBeInTheDocument();
  });
});
