import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PasswordStrengthIndicator, type PasswordRuleCheck } from "./password-strength-indicator";

const rules: PasswordRuleCheck[] = [
  { id: "minLength", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { id: "digit", label: "One number", test: (p) => /[0-9]/.test(p) },
];

describe("PasswordStrengthIndicator", () => {
  it("renders every rule's label", () => {
    render(<PasswordStrengthIndicator password="" rules={rules} />);
    expect(screen.getByText("At least 8 characters")).toBeInTheDocument();
    expect(screen.getByText("One number")).toBeInTheDocument();
  });

  it("marks a passed rule differently from a failed one via class", () => {
    render(<PasswordStrengthIndicator password="short" rules={rules} />);
    const minLength = screen.getByText("At least 8 characters").closest("li");
    const digit = screen.getByText("One number").closest("li");
    expect(minLength?.className).toContain("text-neutral-500");
    expect(digit?.className).toContain("text-neutral-500");
  });

  it("marks rules as passed once the password satisfies them", () => {
    render(<PasswordStrengthIndicator password="password1" rules={rules} />);
    const minLength = screen.getByText("At least 8 characters").closest("li");
    const digit = screen.getByText("One number").closest("li");
    expect(minLength?.className).toContain("text-success-700");
    expect(digit?.className).toContain("text-success-700");
  });
});
