import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "./input";

describe("Input", () => {
  it("renders and accepts typed input", async () => {
    render(<Input placeholder="Email" />);
    const input = screen.getByPlaceholderText("Email");
    await userEvent.type(input, "test@example.com");
    expect(input).toHaveValue("test@example.com");
  });

  it("applies error styling and aria-invalid when error is true", () => {
    render(<Input error placeholder="Email" />);
    const input = screen.getByPlaceholderText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.className).toContain("border-danger-500");
  });

  it("renders a leading icon with left padding", () => {
    render(<Input leadingIcon={<span data-testid="icon" />} placeholder="Search" />);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search").className).toContain("pl-9");
  });
});
