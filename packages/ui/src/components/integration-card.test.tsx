import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntegrationCard } from "./integration-card";

describe("IntegrationCard", () => {
  it("renders name, status, description, and actions", () => {
    render(
      <IntegrationCard
        name="WhatsApp"
        status="CONNECTED"
        description="Business Account connected"
        actions={<button>Disconnect</button>}
      />,
    );
    expect(screen.getByText("WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("CONNECTED")).toBeInTheDocument();
    expect(screen.getByText("Business Account connected")).toBeInTheDocument();
    expect(screen.getByText("Disconnect")).toBeInTheDocument();
  });
});
