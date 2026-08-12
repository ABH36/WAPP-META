import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlanCard } from "./plan-card";

describe("PlanCard", () => {
  it("renders name and price when priced", () => {
    render(<PlanCard name="Growth" monthlyPrice={999} yearlyPrice={9999} currency="INR" />);
    expect(screen.getByText("Growth")).toBeInTheDocument();
    expect(screen.getByText(/INR 999\/mo/)).toBeInTheDocument();
  });

  it("shows 'Contact us for pricing' when price is null", () => {
    render(<PlanCard name="Enterprise" monthlyPrice={null} yearlyPrice={null} currency="INR" />);
    expect(screen.getByText("Contact us for pricing")).toBeInTheDocument();
  });

  it("shows a Current Plan badge and hides the action label when isCurrent", () => {
    render(
      <PlanCard
        name="Starter"
        monthlyPrice={499}
        yearlyPrice={null}
        currency="INR"
        isCurrent
        actionLabel="Switch to Starter"
      />,
    );
    expect(screen.getByText("Current Plan")).toBeInTheDocument();
    expect(screen.queryByText("Switch to Starter")).not.toBeInTheDocument();
  });
});
