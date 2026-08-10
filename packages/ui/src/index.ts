export * from "./lib/cn";
export * from "./lib/status-color";
export * from "./lib/cookies";
export * from "./components/button";
export * from "./components/header";
export * from "./components/sidebar";
export * from "./components/breadcrumb";
export * from "./components/footer";
export * from "./components/skeleton";
export * from "./components/empty-state";

// FRD-001 Volume-1 — the 6 above are the Layout System primitives (DS-001 §4/§5)
// every app's shell composes: Header, Sidebar(+SidebarItem), Breadcrumb, Footer,
// Skeleton(+SkeletonText/SkeletonCard), EmptyState. Everything else in DS-001 §4's
// full inventory (Input, Select, Table, Card, Badge, Modal, Toast, etc.) is added
// incrementally, one per module's frontend implementation step (SDP-001 §6
// "Module Development Order", step 9 of the 12-step module lifecycle) — not all
// at once in Phase 1 Foundation. Button remains the reference pattern every
// subsequent component follows.
