import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContactCard } from "./contact-card";

describe("ContactCard", () => {
  it("renders name and phone number", () => {
    render(<ContactCard name="Priya Sharma" phoneNumber="+919876543210" />);
    expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    expect(screen.getByText("+919876543210")).toBeInTheDocument();
  });

  it("falls back to 'Unknown contact' when name is null", () => {
    render(<ContactCard name={null} phoneNumber="+919876543210" />);
    expect(screen.getByText("Unknown contact")).toBeInTheDocument();
  });
});
