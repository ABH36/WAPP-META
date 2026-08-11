import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "./select";

describe("Select", () => {
  it("renders options and accepts a selection", async () => {
    render(
      <Select aria-label="Date format" defaultValue="DD/MM/YYYY">
        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
      </Select>,
    );
    const select = screen.getByLabelText("Date format");
    await userEvent.selectOptions(select, "MM/DD/YYYY");
    expect(select).toHaveValue("MM/DD/YYYY");
  });

  it("applies error styling and aria-invalid when error is true", () => {
    render(
      <Select aria-label="Time format" error>
        <option value="12h">12h</option>
      </Select>,
    );
    const select = screen.getByLabelText("Time format");
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select.className).toContain("border-danger-500");
  });
});
