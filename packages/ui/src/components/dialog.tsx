"use client";

import * as React from "react";
import { cn } from "../lib/cn";

/**
 * FRD-001 Volume-9 §4.2/§10 — Dialog, DS-001 §4's "Modal" primitive,
 * deferred since Volume-1 until a real accessible-dialog requirement
 * existed. Built on the native `<dialog>` element rather than a hand-rolled
 * focus trap: the browser itself provides focus trapping, Escape-to-close
 * (fires a `cancel` event), focus return to the triggering element on
 * close, and a `::backdrop` pseudo-element — all natively, with far less
 * surface area for an a11y-critical bug than reimplementing them. Chrome,
 * Edge, Firefox, and Safari 15.4+ all support this (DS-001 §4.8's target
 * browser set); `showModal`/`close` calls are wrapped defensively so an
 * older/non-conforming engine degrades to an inert (non-modal) element
 * rather than throwing.
 */
export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
  /** id of the element (usually DialogTitle) that labels this dialog for assistive tech. */
  labelledBy?: string;
}

export function Dialog({
  open,
  onOpenChange,
  children,
  className,
  labelledBy,
}: DialogProps): React.JSX.Element {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    try {
      if (open && !dialog.open) {
        dialog.showModal();
      } else if (!open && dialog.open) {
        dialog.close();
      }
    } catch {
      // Engine doesn't support showModal() — leave as a plain inert element
      // rather than crash; there is nothing further this component can do
      // for that engine (DS-001 §4.8 graceful-degradation policy).
    }
  }, [open]);

  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // Fires for both Escape (native `cancel` -> `close`) and any caller-driven
    // `dialog.close()` — the single source of truth for syncing state back out.
    const handleClose = () => onOpenChange(false);
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onOpenChange]);

  return (
    // The backdrop click-to-close handler below is a supplementary
    // convenience only — Escape already provides the keyboard-equivalent
    // dismissal path (native to <dialog>), matching the WAI-ARIA APG modal
    // dialog pattern's own guidance that a backdrop click needs no separate
    // keyboard handler.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      className={cn(
        "bg-neutral-0 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-50",
        "w-full max-w-md rounded-lg border border-neutral-200 p-6 shadow-lg dark:border-neutral-800",
        "backdrop:bg-neutral-950/50 backdrop:backdrop-blur-sm",
        className,
      )}
      onClick={(e) => {
        // A click landing on the <dialog> element itself (not any child
        // inside the content wrapper) is a backdrop click — the content
        // box only covers its own children's area.
        if (e.target === ref.current) onOpenChange(false);
      }}
      onCancel={(e) => {
        // Let the native Escape-to-close behavior proceed; this only exists
        // so `onOpenChange` fires even in engines that emit `cancel`
        // without also emitting `close` at the same tick.
        e.currentTarget.close();
      }}
    >
      {children}
    </dialog>
  );
}

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn("mb-4 flex flex-col gap-1", className)} {...props} />;
}

export const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  // Content comes from the spread `props.children`; every real usage passes real text.
  // eslint-disable-next-line jsx-a11y/heading-has-content
  <h2 ref={ref} className={cn("text-h3 font-semibold", className)} {...props} />
));
DialogTitle.displayName = "DialogTitle";

export function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>): React.JSX.Element {
  return (
    <p
      className={cn("text-body-sm text-neutral-500 dark:text-neutral-400", className)}
      {...props}
    />
  );
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn("mt-6 flex justify-end gap-2", className)} {...props} />;
}
