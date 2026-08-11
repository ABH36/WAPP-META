import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatBubble } from "./chat-bubble";

describe("ChatBubble", () => {
  it("renders inbound message text", () => {
    render(
      <ChatBubble direction="INBOUND" text="Hello there" occurredAt="2026-08-11T10:00:00.000Z" />,
    );
    expect(screen.getByText("Hello there")).toBeInTheDocument();
  });

  it("renders a fallback for unsupported content", () => {
    render(<ChatBubble direction="INBOUND" text={null} occurredAt="2026-08-11T10:00:00.000Z" />);
    expect(screen.getByText("Unsupported message content")).toBeInTheDocument();
  });

  it("only shows a status icon for outbound messages", () => {
    const { container, rerender } = render(
      <ChatBubble
        direction="INBOUND"
        text="Hi"
        occurredAt="2026-08-11T10:00:00.000Z"
        status="READ"
      />,
    );
    expect(container.querySelectorAll("svg")).toHaveLength(0);

    rerender(
      <ChatBubble
        direction="OUTBOUND"
        text="Hi"
        occurredAt="2026-08-11T10:00:00.000Z"
        status="READ"
      />,
    );
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
  });
});
