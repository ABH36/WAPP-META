import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WebhookCard } from "./webhook-card";

describe("WebhookCard", () => {
  it("renders url, status, events, and last-delivery status", () => {
    render(
      <WebhookCard
        url="https://example.com/hook"
        status="CONNECTED"
        enabled
        events={["LEAD_CREATED", "DEAL_WON"]}
        lastDeliveryAt="2026-08-01T00:00:00.000Z"
        lastError={null}
      />,
    );
    expect(screen.getByText("https://example.com/hook")).toBeInTheDocument();
    expect(screen.getByText("LEAD_CREATED")).toBeInTheDocument();
    expect(screen.getByText("DEAL_WON")).toBeInTheDocument();
    expect(screen.getByText(/Last delivered/)).toBeInTheDocument();
  });

  it("shows the last error instead of a success message when present", () => {
    render(
      <WebhookCard
        url="https://example.com/hook"
        status="ERROR"
        enabled
        events={["LEAD_CREATED"]}
        lastDeliveryAt="2026-08-01T00:00:00.000Z"
        lastError="Timed out"
      />,
    );
    expect(screen.getByText("Last delivery failed: Timed out")).toBeInTheDocument();
  });

  it("calls onToggleEnabled when the switch is clicked", () => {
    const onToggleEnabled = vi.fn();
    render(
      <WebhookCard
        url="https://example.com/hook"
        status="CONNECTED"
        enabled
        events={["LEAD_CREATED"]}
        lastDeliveryAt={null}
        lastError={null}
        onToggleEnabled={onToggleEnabled}
      />,
    );
    fireEvent.click(screen.getByRole("switch"));
    expect(onToggleEnabled).toHaveBeenCalledWith(false);
  });
});
