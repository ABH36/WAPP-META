import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DealTile } from "./deal-tile";

describe("DealTile", () => {
  it("renders title, value, and probability", () => {
    render(<DealTile title="Acme Renewal" value={25000} currency="INR" probability={40} />);
    expect(screen.getByText("Acme Renewal")).toBeInTheDocument();
    expect(screen.getByText("INR 25,000")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("omits the owner line when no ownerLabel is given", () => {
    render(<DealTile title="Acme Renewal" value={25000} currency="INR" probability={40} />);
    expect(screen.queryByText("Unassigned")).not.toBeInTheDocument();
  });
});
