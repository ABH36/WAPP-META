import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MaintenanceBanner } from "./maintenance-banner";

describe("MaintenanceBanner", () => {
  it("shows the normal-operation message when disabled", () => {
    render(<MaintenanceBanner enabled={false} reason={null} />);
    expect(screen.getByText("Platform is operating normally")).toBeInTheDocument();
  });

  it("shows the enabled message and reason when enabled", () => {
    render(<MaintenanceBanner enabled reason="Database migration in progress" />);
    expect(screen.getByText("Maintenance Mode is ENABLED")).toBeInTheDocument();
    expect(screen.getByText("Database migration in progress")).toBeInTheDocument();
  });

  it("omits the reason line when none is given", () => {
    render(<MaintenanceBanner enabled reason={null} />);
    expect(screen.getByText("Maintenance Mode is ENABLED")).toBeInTheDocument();
  });
});
