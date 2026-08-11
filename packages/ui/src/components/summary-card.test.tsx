import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SummaryCard } from "./summary-card";

describe("SummaryCard", () => {
  it("renders label and value", () => {
    render(<SummaryCard label="CRM" value="42 customers" />);
    expect(screen.getByText("CRM")).toBeInTheDocument();
    expect(screen.getByText("42 customers")).toBeInTheDocument();
  });

  it("renders an optional description", () => {
    render(<SummaryCard label="Billing" value="₹0" description="No pending invoices" />);
    expect(screen.getByText("No pending invoices")).toBeInTheDocument();
  });

  it("wraps in a link when href is provided", () => {
    render(<SummaryCard label="CRM" value="42" href="/crm" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/crm");
  });

  it("does not render a link when href is omitted", () => {
    render(<SummaryCard label="CRM" value="42" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
