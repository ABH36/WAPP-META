import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InvoiceCard } from "./invoice-card";

describe("InvoiceCard", () => {
  it("renders invoice number, status, and amount", () => {
    render(
      <InvoiceCard
        invoiceNumber="INV-0001"
        status="ISSUED"
        amount={5000}
        currency="INR"
        dueDate="2026-09-01T00:00:00.000Z"
        issuedAt="2026-08-01T00:00:00.000Z"
      />,
    );
    expect(screen.getByText("INV-0001")).toBeInTheDocument();
    expect(screen.getByText("ISSUED")).toBeInTheDocument();
    expect(screen.getByText("INR 5,000")).toBeInTheDocument();
  });

  it("shows 'Pricing pending' when amount is null", () => {
    render(
      <InvoiceCard
        invoiceNumber="INV-0002"
        status="ISSUED"
        amount={null}
        currency="INR"
        dueDate="2026-09-01T00:00:00.000Z"
        issuedAt="2026-08-01T00:00:00.000Z"
      />,
    );
    expect(screen.getByText("Pricing pending")).toBeInTheDocument();
  });
});
