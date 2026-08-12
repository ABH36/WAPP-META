import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaymentCard } from "./payment-card";

describe("PaymentCard", () => {
  it("renders gateway, status, amount, and reference", () => {
    render(
      <PaymentCard
        gateway="Manual"
        gatewayReference="REF-123"
        status="PAID"
        amount={2500}
        currency="INR"
        paidAt="2026-08-05T00:00:00.000Z"
      />,
    );
    expect(screen.getByText("Manual")).toBeInTheDocument();
    expect(screen.getByText("PAID")).toBeInTheDocument();
    expect(screen.getByText("INR 2,500")).toBeInTheDocument();
    expect(screen.getByText("REF-123")).toBeInTheDocument();
  });

  it("shows 'Not yet paid' when paidAt is null", () => {
    render(
      <PaymentCard
        gateway="Manual"
        gatewayReference="REF-124"
        status="PENDING"
        amount={1000}
        currency="INR"
        paidAt={null}
      />,
    );
    expect(screen.getByText("Not yet paid")).toBeInTheDocument();
  });
});
