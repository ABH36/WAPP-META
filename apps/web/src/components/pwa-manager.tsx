"use client";

import * as React from "react";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * FRD-001 Volume-9 §4.3/§11 — service worker registration, install prompt,
 * and update notification, all in one client component mounted once from
 * `AppProviders` (`apps/web` only). Reuses the existing global `Toaster`
 * (sonner, `AppProviders`) rather than a new bespoke banner primitive —
 * `duration: Infinity` + an action button gives the same persistent,
 * dismissible, actionable UI a dedicated banner would, with zero new
 * `packages/ui` surface. `process.env.NODE_ENV` is one of the few values
 * Next.js always inlines into the client bundle at build time, so this
 * check is safe to run in the browser (no `NEXT_PUBLIC_` prefix needed) —
 * matches `next.config.ts`'s `disable: NODE_ENV === "development"`, so in
 * dev `/sw.js` never exists and this effect is a harmless no-op.
 *
 * Registration is deferred until the window `load` event (not fired
 * immediately on mount) — a real, Lighthouse-measured regression during
 * this volume's own verification: registering eagerly added ~700ms of
 * Total Blocking Time by competing with initial hydration for the main
 * thread. Deferring past `load` is the standard service-worker-registration
 * performance practice for exactly this reason.
 */
export function PwaManager(): null {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const notifyUpdate = (waitingWorker: ServiceWorker) => {
      toast("A new version of WAPP is available.", {
        id: "pwa-update",
        duration: Infinity,
        action: {
          label: "Reload",
          onClick: () => {
            waitingWorker.postMessage("SKIP_WAITING");
          },
        },
      });
    };

    const registerServiceWorker = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          if (reg.waiting) {
            notifyUpdate(reg.waiting);
          }
          reg.addEventListener("updatefound", () => {
            const installing = reg.installing;
            if (!installing) return;
            installing.addEventListener("statechange", () => {
              if (installing.state === "installed" && navigator.serviceWorker.controller) {
                notifyUpdate(installing);
              }
            });
          });
        })
        .catch((err: unknown) => {
          console.error("Service worker registration failed", err);
        });
    };

    if (document.readyState === "complete") {
      registerServiceWorker();
    } else {
      window.addEventListener("load", registerServiceWorker, { once: true });
    }

    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      window.removeEventListener("load", registerServiceWorker);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  React.useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const installEvent = event as BeforeInstallPromptEvent;
      toast("Install WAPP for quick access from your home screen.", {
        id: "pwa-install",
        duration: Infinity,
        action: {
          label: "Install",
          onClick: () => {
            void installEvent.prompt();
          },
        },
      });
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  return null;
}
