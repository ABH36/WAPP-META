import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar, SidebarItem } from "./sidebar";

describe("Sidebar", () => {
  it("renders header, footer, and nav children", () => {
    render(
      <Sidebar header={<span>Logo</span>} footer={<span>User menu</span>}>
        <SidebarItem href="/dashboard">Dashboard</SidebarItem>
      </Sidebar>,
    );
    expect(screen.getByText("Logo")).toBeInTheDocument();
    expect(screen.getByText("User menu")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("is wider when expanded than when collapsed", () => {
    const { container: expanded } = render(<Sidebar collapsed={false} />);
    const { container: collapsed } = render(<Sidebar collapsed />);
    expect(expanded.firstChild).toHaveClass("w-64");
    expect(collapsed.firstChild).toHaveClass("w-16");
  });

  it("SidebarItem hides its label text when collapsed", () => {
    render(
      <SidebarItem href="/dashboard" collapsed>
        Dashboard
      </SidebarItem>,
    );
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });
});
