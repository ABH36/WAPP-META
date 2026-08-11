import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkspaceStatus } from "@wapp/shared-types";
import { WorkspaceStatusBadge } from "./workspace-status-badge";

describe("WorkspaceStatusBadge", () => {
  it("renders a human-readable label for each status", () => {
    render(<WorkspaceStatusBadge status={WorkspaceStatus.TRIAL} />);
    expect(screen.getByText("Trial")).toBeInTheDocument();
  });

  it("maps ACTIVE to the success variant", () => {
    render(<WorkspaceStatusBadge status={WorkspaceStatus.ACTIVE} />);
    expect(screen.getByText("Active").className).toContain("bg-success-50");
  });

  it("maps SUSPENDED to the danger variant", () => {
    render(<WorkspaceStatusBadge status={WorkspaceStatus.SUSPENDED} />);
    expect(screen.getByText("Suspended").className).toContain("bg-danger-50");
  });
});
