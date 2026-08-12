import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlatformUserCard } from "./platform-user-card";

describe("PlatformUserCard", () => {
  it("renders name, email, role, and status", () => {
    render(
      <PlatformUserCard
        fullName="Jane Admin"
        email="jane@wapp.internal"
        role="PLATFORM_SUPER_ADMIN"
        isActive
        lastLoginAt="2026-08-01T00:00:00.000Z"
      />,
    );
    expect(screen.getByText("Jane Admin")).toBeInTheDocument();
    expect(screen.getByText("jane@wapp.internal")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
  });

  it("shows 'Never logged in' when lastLoginAt is null", () => {
    render(
      <PlatformUserCard
        fullName="Jane"
        email="jane@wapp.internal"
        role="PLATFORM_SUPPORT_EXECUTIVE"
        isActive={false}
        lastLoginAt={null}
      />,
    );
    expect(screen.getByText("Never logged in")).toBeInTheDocument();
    expect(screen.getByText("INACTIVE")).toBeInTheDocument();
  });
});
