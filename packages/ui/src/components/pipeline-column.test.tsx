import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipelineColumn } from "./pipeline-column";

describe("PipelineColumn", () => {
  it("renders title, count, and children", () => {
    render(
      <PipelineColumn title="Negotiation" count={3}>
        <span>Deal A</span>
      </PipelineColumn>,
    );
    expect(screen.getByText("Negotiation")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Deal A")).toBeInTheDocument();
  });

  it("renders totalValue when given", () => {
    render(
      <PipelineColumn title="Open" count={1} totalValue="INR 10,000">
        <span>Deal A</span>
      </PipelineColumn>,
    );
    expect(screen.getByText("INR 10,000")).toBeInTheDocument();
  });
});
