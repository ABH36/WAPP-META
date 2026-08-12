"use client";

import * as React from "react";

/**
 * FRD-001 Volume-9 §4.4/§4.5 — tracks `navigator.onLine` plus the
 * `online`/`offline` window events, for the header's offline indicator and
 * any screen that wants to gracefully degrade a network action. Starts
 * `true` on the server/first render (no `navigator` there) and corrects
 * itself on mount — a brief false-positive "online" flash is preferable to
 * hydration mismatch warnings.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = React.useState(true);

  React.useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
