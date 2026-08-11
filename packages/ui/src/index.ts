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
// Skeleton(+SkeletonText/SkeletonCard), EmptyState. Button remains the reference
// pattern every subsequent component follows.

export * from "./components/input";
export * from "./components/password-input";
export * from "./components/password-strength-indicator";
export * from "./components/card";
export * from "./components/alert";
export * from "./components/badge";
export * from "./components/table";
export * from "./components/session-card";
export * from "./components/login-history-table";

// FRD-001 Volume-2 — the 9 above are what Authentication & Identity UI needs
// (DS-001 §4/§6: Input, Password Input, Password Strength Indicator, Card,
// Alert, Badge, Table, Session Card, Login History Table). "Login Form" and
// "Security Settings Panel" (also named in §6) are deliberately NOT shared
// components — see docs/ADR-FE-003-authentication-ui-strategy.md — they're
// app-specific compositions (different services/stores per app), built
// inside each app's own src/features/auth/ directory instead. Everything
// else in DS-001 §4's full inventory (Select, Textarea, Modal, Toast, Tabs,
// etc.) stays deferred to whichever module's real screens need it first,
// per the pre-existing incremental-addition convention.

export * from "./components/select";
export * from "./components/switch";
export * from "./components/textarea";
export * from "./components/summary-card";
export * from "./components/workspace-status-badge";

// FRD-001 Volume-3 — the 5 above are what Workspace UI needs (DS-001 §4:
// Select, Switch, Textarea, plus two new presentational primitives — Summary
// Card and Workspace Status Badge — for §7's "Workspace Summary Card"/
// "Workspace Status Badge" component names). "Business Profile Form", "Business Hours
// Editor", "Branding Panel", and "Notification Toggle List" (also named in
// §7) are deliberately NOT shared components, for the same reason as
// Login Form/Security Settings Panel — each binds to app-specific service
// calls and mutation wiring — built inside apps/web/src/features/workspace/
// instead. DS-001 §4 also names no generic page-section-header pattern
// (title+description+action) — rather than inventing an unapproved shared
// name, that composition lives locally inside each Workspace page too; see
// docs/ADR-FE-005-workspace-ui-strategy.md.
