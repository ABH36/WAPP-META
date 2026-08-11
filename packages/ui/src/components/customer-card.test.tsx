import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CustomerCard } from "./customer-card";

describe("CustomerCard", () => {
  it("renders name, status, and mobile number", () => {
    render(
      <CustomerCard customerName="Priya Sharma" status="ACTIVE" mobileNumber="+919876543210" />,
    );
    expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    expect(screen.getByText(/\+919876543210/)).toBeInTheDocument();
  });

  it("includes the company name when given", () => {
    render(
      <CustomerCard
        customerName="Priya Sharma"
        companyName="Acme Corp"
        status="ACTIVE"
        mobileNumber="+919876543210"
      />,
    );
    expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
  });
});
