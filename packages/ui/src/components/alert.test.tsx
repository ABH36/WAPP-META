import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Alert } from "./alert";

describe("Alert", () => {
  it("renders as role=alert with its message", () => {
    render(<Alert variant="danger">Invalid credentials</Alert>);
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid credentials");
  });

  it("defaults to the info variant", () => {
    render(<Alert>Notice</Alert>);
    expect(screen.getByRole("alert").className).toContain("bg-info-50");
  });

  it("shows a dismiss button only when onDismiss is provided, and calls it", async () => {
    const onDismiss = vi.fn();
    render(
      <Alert variant="warning" onDismiss={onDismiss}>
        Maintenance
      </Alert>,
    );
    const button = screen.getByRole("button", { name: "Dismiss" });
    await userEvent.click(button);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("has no dismiss button when onDismiss is omitted", () => {
    render(<Alert variant="danger">Error</Alert>);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
