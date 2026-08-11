import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TemplateCard } from "./template-card";

describe("TemplateCard", () => {
  it("renders name, category, and language", () => {
    render(
      <TemplateCard
        name="order_confirmation"
        category="UTILITY"
        language="en_US"
        status="APPROVED"
      />,
    );
    expect(screen.getByText("order_confirmation")).toBeInTheDocument();
    expect(screen.getByText("UTILITY · en_US")).toBeInTheDocument();
    expect(screen.getByText("APPROVED")).toBeInTheDocument();
  });

  it("shows the rejection reason only when status is REJECTED", () => {
    const { rerender } = render(
      <TemplateCard
        name="promo"
        category="MARKETING"
        language="en_US"
        status="REJECTED"
        rejectionReason="Policy violation"
      />,
    );
    expect(screen.getByText("Policy violation")).toBeInTheDocument();

    rerender(
      <TemplateCard
        name="promo"
        category="MARKETING"
        language="en_US"
        status="APPROVED"
        rejectionReason="Policy violation"
      />,
    );
    expect(screen.queryByText("Policy violation")).not.toBeInTheDocument();
  });
});
