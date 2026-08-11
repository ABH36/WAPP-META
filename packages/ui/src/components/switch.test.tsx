import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Switch } from "./switch";

describe("Switch", () => {
  it("reflects the checked prop via aria-checked", () => {
    render(<Switch checked aria-label="Broadcast completed" onCheckedChange={() => {}} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("calls onCheckedChange with the toggled value when clicked", async () => {
    const onCheckedChange = vi.fn();
    render(<Switch checked={false} aria-label="Task reminder" onCheckedChange={onCheckedChange} />);
    await userEvent.click(screen.getByRole("switch"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("does not call onCheckedChange when disabled", async () => {
    const onCheckedChange = vi.fn();
    render(
      <Switch checked={false} disabled aria-label="Locked" onCheckedChange={onCheckedChange} />,
    );
    await userEvent.click(screen.getByRole("switch"));
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
