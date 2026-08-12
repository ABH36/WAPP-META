import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SkipLink } from "./skip-link";

describe("SkipLink", () => {
  it("renders a link to #main-content with default text", () => {
    render(<SkipLink href="#main-content" />);
    const link = screen.getByRole("link", { name: "Skip to main content" });
    expect(link).toHaveAttribute("href", "#main-content");
  });

  it("is visually hidden until focused", () => {
    render(<SkipLink href="#main-content" />);
    expect(screen.getByRole("link")).toHaveClass("sr-only");
  });
});
