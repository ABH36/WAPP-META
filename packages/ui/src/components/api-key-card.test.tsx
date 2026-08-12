import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ApiKeyCard } from "./api-key-card";

describe("ApiKeyCard", () => {
  it("renders name, prefix, scope, status, and never a raw secret", () => {
    render(
      <ApiKeyCard
        name="CI Key"
        prefix="wapp_ab12"
        scope="READ"
        status="ACTIVE"
        lastUsedAt={null}
        expiresAt={null}
      />,
    );
    expect(screen.getByText("CI Key")).toBeInTheDocument();
    expect(screen.getByText("wapp_ab12…")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    expect(screen.getByText("Never used")).toBeInTheDocument();
  });

  it("calls onRevoke when Revoke is clicked", () => {
    const onRevoke = vi.fn();
    render(
      <ApiKeyCard
        name="CI Key"
        prefix="wapp_ab12"
        scope="READ"
        status="ACTIVE"
        lastUsedAt={null}
        expiresAt={null}
        onRevoke={onRevoke}
      />,
    );
    fireEvent.click(screen.getByText("Revoke"));
    expect(onRevoke).toHaveBeenCalledOnce();
  });

  it("hides actions once a key is revoked", () => {
    render(
      <ApiKeyCard
        name="CI Key"
        prefix="wapp_ab12"
        scope="READ"
        status="REVOKED"
        lastUsedAt={null}
        expiresAt={null}
        onRevoke={vi.fn()}
      />,
    );
    expect(screen.queryByText("Revoke")).not.toBeInTheDocument();
  });
});
