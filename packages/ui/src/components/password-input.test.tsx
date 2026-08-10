import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PasswordInput } from "./password-input";

describe("PasswordInput", () => {
  it("defaults to type=password", () => {
    render(<PasswordInput placeholder="Password" />);
    expect(screen.getByPlaceholderText("Password")).toHaveAttribute("type", "password");
  });

  it("toggles to type=text when the show button is clicked", async () => {
    render(<PasswordInput placeholder="Password" />);
    const toggle = screen.getByRole("button", { name: "Show password" });
    await userEvent.click(toggle);
    expect(screen.getByPlaceholderText("Password")).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();
  });

  it("toggles back to type=password on a second click", async () => {
    render(<PasswordInput placeholder="Password" />);
    const toggle = screen.getByRole("button", { name: "Show password" });
    await userEvent.click(toggle);
    await userEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(screen.getByPlaceholderText("Password")).toHaveAttribute("type", "password");
  });
});
