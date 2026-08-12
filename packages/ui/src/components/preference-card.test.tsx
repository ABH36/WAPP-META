import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PreferenceCard } from "./preference-card";

describe("PreferenceCard", () => {
  it("renders label, description, and the control slot", () => {
    render(
      <PreferenceCard
        label="Theme"
        description="Choose light or dark"
        control={<button>Toggle</button>}
      />,
    );
    expect(screen.getByText("Theme")).toBeInTheDocument();
    expect(screen.getByText("Choose light or dark")).toBeInTheDocument();
    expect(screen.getByText("Toggle")).toBeInTheDocument();
  });
});
