import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExportJobCard } from "./export-job-card";

describe("ExportJobCard", () => {
  it("renders a download link when completed with a resultUrl", () => {
    render(
      <ExportJobCard
        entityType="LEADS"
        format="CSV"
        status="COMPLETED"
        createdAt="2026-08-01T00:00:00.000Z"
        resultUrl="https://storage.example.com/export.csv"
      />,
    );
    const link = screen.getByText("Download →");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "https://storage.example.com/export.csv");
  });

  it("renders the error message instead of a download link when failed", () => {
    render(
      <ExportJobCard
        entityType="LEADS"
        format="CSV"
        status="FAILED"
        createdAt="2026-08-01T00:00:00.000Z"
        error="Something went wrong"
      />,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.queryByText("Download →")).not.toBeInTheDocument();
  });

  it("renders neither when still pending", () => {
    render(
      <ExportJobCard
        entityType="LEADS"
        format="CSV"
        status="PENDING"
        createdAt="2026-08-01T00:00:00.000Z"
      />,
    );
    expect(screen.queryByText("Download →")).not.toBeInTheDocument();
  });
});
