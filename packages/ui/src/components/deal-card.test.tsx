import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DealCard } from "./deal-card";

describe("DealCard", () => {
  it("renders title, stage, value, and probability", () => {
    render(
      <DealCard
        title="Acme Renewal"
        stage="NEGOTIATION"
        value={50000}
        currency="INR"
        probability={60}
      />,
    );
    expect(screen.getByText("Acme Renewal")).toBeInTheDocument();
    expect(screen.getByText("NEGOTIATION")).toBeInTheDocument();
    expect(screen.getByText("INR 50,000")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("shows 'No close date' when expectedCloseDate is absent", () => {
    render(
      <DealCard title="Acme Renewal" stage="OPEN" value={1000} currency="INR" probability={10} />,
    );
    expect(screen.getByText("No close date")).toBeInTheDocument();
  });
});
