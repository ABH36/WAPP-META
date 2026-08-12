import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./dialog";

describe("Dialog", () => {
  it("renders its content regardless of native showModal support", () => {
    render(
      <Dialog open onOpenChange={() => {}} labelledBy="test-title">
        <DialogHeader>
          <DialogTitle id="test-title">Confirm action</DialogTitle>
          <DialogDescription>This cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>Actions here</DialogFooter>
      </Dialog>,
    );
    expect(screen.getByText("Confirm action")).toBeInTheDocument();
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
  });

  it("calls onOpenChange(false) when the dialog fires a close event", () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <p>content</p>
      </Dialog>,
    );
    const dialog = screen.getByText("content").closest("dialog");
    expect(dialog).not.toBeNull();
    fireEvent(dialog as HTMLDialogElement, new Event("close"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onOpenChange(false) on a direct backdrop click, not a click inside content", () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <p>content</p>
      </Dialog>,
    );
    fireEvent.click(screen.getByText("content"));
    expect(onOpenChange).not.toHaveBeenCalled();

    const dialog = screen.getByText("content").closest("dialog") as HTMLDialogElement;
    fireEvent.click(dialog);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
