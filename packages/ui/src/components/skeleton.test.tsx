import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton, SkeletonText, SkeletonCard } from "./skeleton";

describe("Skeleton", () => {
  it("renders a single skeleton block", () => {
    const { container } = render(<Skeleton className="h-4 w-full" />);
    expect(container.firstChild).toHaveClass("animate-pulse");
  });

  it("SkeletonText renders the requested number of lines", () => {
    const { container } = render(<SkeletonText lines={4} />);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(4);
  });

  it("SkeletonText defaults to 3 lines", () => {
    const { container } = render(<SkeletonText />);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);
  });

  it("SkeletonCard renders a title skeleton and text skeleton", () => {
    const { container } = render(<SkeletonCard />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(1);
  });
});
