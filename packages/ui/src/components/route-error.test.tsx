import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouteError } from "./route-error";

describe("RouteError", () => {
  it("shows the digest for correlation, never the raw error message", () => {
    render(
      <RouteError
        error={Object.assign(new Error("a raw internal stack trace detail"), { digest: "abc123" })}
        reset={() => {}}
      />,
    );
    expect(screen.getByText(/Reference: abc123/)).toBeInTheDocument();
    expect(screen.queryByText(/a raw internal stack trace detail/)).not.toBeInTheDocument();
  });

  it("falls back to a generic message when there is no digest", () => {
    render(<RouteError error={new Error("boom")} reset={() => {}} />);
    expect(screen.getByText("An unexpected error occurred. Please try again.")).toBeInTheDocument();
  });

  it("calls reset when 'Try again' is clicked", async () => {
    const reset = vi.fn();
    render(<RouteError error={new Error("boom")} reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
