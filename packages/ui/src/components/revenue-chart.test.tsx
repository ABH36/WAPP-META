import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RevenueChart } from "./revenue-chart";

describe("RevenueChart", () => {
  it("shows an empty state when there is no data", () => {
    render(<RevenueChart type="bar" data={[]} />);
    expect(screen.getByText("No data available")).toBeInTheDocument();
  });

  it("renders a bar chart without throwing when given data", () => {
    const { container } = render(
      <RevenueChart
        type="bar"
        data={[
          { label: "Jan", value: 100 },
          { label: "Feb", value: 200 },
        ]}
      />,
    );
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });

  it("renders a line chart without throwing when given data", () => {
    const { container } = render(<RevenueChart type="line" data={[{ label: "Q1", value: 500 }]} />);
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });

  it("renders a pie chart without throwing when given data", () => {
    const { container } = render(
      <RevenueChart
        type="pie"
        data={[
          { label: "WhatsApp", value: 40 },
          { label: "Website", value: 60 },
        ]}
      />,
    );
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });
});
