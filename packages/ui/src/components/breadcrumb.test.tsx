import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Breadcrumb } from "./breadcrumb";

describe("Breadcrumb", () => {
  it("renders every item and marks the last as the current page", () => {
    render(
      <Breadcrumb
        items={[
          { label: "Customers", href: "/customers" },
          { label: "Acme Corp", href: "/customers/acme" },
          { label: "Overview" },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "Customers" })).toHaveAttribute("href", "/customers");
    expect(screen.getByRole("link", { name: "Acme Corp" })).toHaveAttribute(
      "href",
      "/customers/acme",
    );
    const current = screen.getByText("Overview");
    expect(current).toHaveAttribute("aria-current", "page");
  });

  it("renders a single item with no link as the current page", () => {
    render(<Breadcrumb items={[{ label: "Dashboard" }]} />);
    expect(screen.getByText("Dashboard")).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
