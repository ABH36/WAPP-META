import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionCard } from "./session-card";

describe("SessionCard", () => {
  it("renders device, browser, IP and last-active info", () => {
    render(
      <SessionCard
        device="Windows"
        browser="Chrome"
        ipAddress="203.0.113.1"
        lastActiveAt="Jan 1, 2026, 12:00 PM"
        onRevoke={vi.fn()}
      />,
    );
    expect(screen.getByText("Windows · Chrome")).toBeInTheDocument();
    expect(screen.getByText(/203\.0\.113\.1/)).toBeInTheDocument();
  });

  it("shows Unknown IP when ipAddress is null", () => {
    render(
      <SessionCard
        device="Mac"
        browser="Safari"
        ipAddress={null}
        lastActiveAt="now"
        onRevoke={vi.fn()}
      />,
    );
    expect(screen.getByText(/Unknown IP/)).toBeInTheDocument();
  });

  it("calls onRevoke when the Revoke button is clicked", async () => {
    const onRevoke = vi.fn();
    render(
      <SessionCard
        device="Mac"
        browser="Safari"
        ipAddress="1.2.3.4"
        lastActiveAt="now"
        onRevoke={onRevoke}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Revoke" }));
    expect(onRevoke).toHaveBeenCalledTimes(1);
  });

  it("disables the Revoke button while revoking", () => {
    render(
      <SessionCard
        device="Mac"
        browser="Safari"
        ipAddress="1.2.3.4"
        lastActiveAt="now"
        onRevoke={vi.fn()}
        revoking
      />,
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("never renders a 'current session' indicator (Architecture Review, 2026-08-10 — no backend support)", () => {
    render(
      <SessionCard
        device="Mac"
        browser="Safari"
        ipAddress="1.2.3.4"
        lastActiveAt="now"
        onRevoke={vi.fn()}
      />,
    );
    expect(screen.queryByText(/current/i)).not.toBeInTheDocument();
  });
});
