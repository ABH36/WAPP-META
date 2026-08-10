import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders title, description, and action", () => {
    render(
      <EmptyState
        title="No leads yet"
        description="Create your first lead to get started."
        action={<button>Create lead</button>}
      />,
    );
    expect(screen.getByRole("heading", { name: "No leads yet" })).toBeInTheDocument();
    expect(screen.getByText("Create your first lead to get started.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create lead" })).toBeInTheDocument();
  });

  it("renders without optional description/action", () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByRole("heading", { name: "Nothing here" })).toBeInTheDocument();
  });
});
