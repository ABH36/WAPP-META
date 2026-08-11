import "@testing-library/jest-dom/vitest";

// FRD-001 Volume-5 — jsdom has no ResizeObserver; Recharts' ResponsiveContainer
// requires one to mount at all. A no-op stub is enough for component tests,
// which don't depend on real resize callbacks firing.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}
