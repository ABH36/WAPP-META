import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SidebarGroup } from "./sidebar-group";

describe("SidebarGroup", () => {
  it("is closed by default and opens on click", async () => {
    render(
      <SidebarGroup label="Communication">
        <span>Inbox</span>
      </SidebarGroup>,
    );
    expect(screen.queryByText("Inbox")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /communication/i }));
    expect(screen.getByText("Inbox")).toBeInTheDocument();
  });

  it("starts open when defaultOpen is true", () => {
    render(
      <SidebarGroup label="Communication" defaultOpen>
        <span>Inbox</span>
      </SidebarGroup>,
    );
    expect(screen.getByText("Inbox")).toBeInTheDocument();
  });

  it("renders only the icon, no children, when collapsed", () => {
    render(
      <SidebarGroup label="Communication" collapsed defaultOpen icon={<span data-testid="icon" />}>
        <span>Inbox</span>
      </SidebarGroup>,
    );
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.queryByText("Inbox")).not.toBeInTheDocument();
    expect(screen.queryByText("Communication")).not.toBeInTheDocument();
  });
});
