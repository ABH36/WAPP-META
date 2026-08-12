import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SettingsSection } from "./settings-section";

describe("SettingsSection", () => {
  it("renders title, description, action, and children", () => {
    render(
      <SettingsSection
        title="Preferences"
        description="Manage your personal settings"
        action={<button>Save</button>}
      >
        <p>Content</p>
      </SettingsSection>,
    );
    expect(screen.getByText("Preferences")).toBeInTheDocument();
    expect(screen.getByText("Manage your personal settings")).toBeInTheDocument();
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });
});
