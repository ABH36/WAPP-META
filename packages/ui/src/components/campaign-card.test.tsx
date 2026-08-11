import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CampaignCard } from "./campaign-card";

describe("CampaignCard", () => {
  it("renders name, status, and wave count", () => {
    render(
      <CampaignCard
        name="Festive Series"
        status="ACTIVE"
        waveCount={3}
        sentCount={10}
        totalCount={30}
      />,
    );
    expect(screen.getByText("Festive Series")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    expect(screen.getByText(/3 waves/)).toBeInTheDocument();
    expect(screen.getByText(/Send progress: 10\/30/)).toBeInTheDocument();
  });

  it("uses singular 'wave' for a count of 1", () => {
    render(<CampaignCard name="Single wave" status="ACTIVE" waveCount={1} />);
    expect(screen.getByText(/1 wave$/)).toBeInTheDocument();
  });
});
