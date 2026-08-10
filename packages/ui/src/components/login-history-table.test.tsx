import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoginHistoryTable, type LoginHistoryEntryView } from "./login-history-table";

const entries: LoginHistoryEntryView[] = [
  {
    id: "1",
    success: true,
    reason: null,
    ipAddress: "203.0.113.1",
    device: "Windows",
    browser: "Chrome",
    occurredAt: "Jan 1, 2026, 9:00 AM",
  },
  {
    id: "2",
    success: false,
    reason: "INVALID_CREDENTIALS",
    ipAddress: "198.51.100.2",
    device: "Mac",
    browser: "Safari",
    occurredAt: "Jan 2, 2026, 10:00 AM",
  },
];

describe("LoginHistoryTable", () => {
  it("renders an empty state when there are no entries", () => {
    render(<LoginHistoryTable entries={[]} formatReason={() => "n/a"} />);
    expect(screen.getByText("No login activity yet")).toBeInTheDocument();
  });

  it("renders one row per entry with the formatted reason", () => {
    render(
      <LoginHistoryTable
        entries={entries}
        formatReason={(reason, success) => (success ? "OK" : `Failed: ${reason}`)}
      />,
    );
    expect(screen.getByText("OK")).toBeInTheDocument();
    expect(screen.getByText("Failed: INVALID_CREDENTIALS")).toBeInTheDocument();
    expect(screen.getByText("Windows · Chrome")).toBeInTheDocument();
    expect(screen.getByText("Mac · Safari")).toBeInTheDocument();
  });

  it("shows Unknown for a null IP address", () => {
    render(
      <LoginHistoryTable
        entries={[{ ...entries[0]!, ipAddress: null }]}
        formatReason={() => "OK"}
      />,
    );
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });
});
