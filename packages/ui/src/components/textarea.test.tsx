import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Textarea } from "./textarea";

describe("Textarea", () => {
  it("renders and accepts typed input", async () => {
    render(<Textarea placeholder="Description" />);
    const textarea = screen.getByPlaceholderText("Description");
    await userEvent.type(textarea, "A short business description");
    expect(textarea).toHaveValue("A short business description");
  });

  it("applies error styling and aria-invalid when error is true", () => {
    render(<Textarea error placeholder="Description" />);
    const textarea = screen.getByPlaceholderText("Description");
    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(textarea.className).toContain("border-danger-500");
  });
});
