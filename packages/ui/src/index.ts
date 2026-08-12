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

export * from "./components/sidebar-group";
export * from "./components/conversation-card";
export * from "./components/chat-bubble";
export * from "./components/template-card";
export * from "./components/broadcast-card";
export * from "./components/campaign-card";
export * from "./components/contact-card";

// FRD-001 Volume-4 — SidebarGroup (an extension of Volume-1's Sidebar
// system, §6's "Communication expands into...") plus the 6 below are
// Communication UI's presentational
// primitives (§7: ConversationCard, ChatBubble, TemplateCard, ContactCard;
// CampaignCard as named, plus BroadcastCard added because the Architecture
// Review, 2026-08-11, required Broadcasts and Campaigns to be exposed as
// the two distinct backend resources they actually are — the FRD's
// original §7 list only anticipated one). "MessageComposer", "ConversationList"
// (DS-001 §7's other two names) are deliberately NOT shared components —
// same reasoning as every prior volume's forms — they bind to app-specific
// service calls, polling, and the 24-hour compliance-window handling, built
// inside apps/web/src/features/communication/ instead. "LabelBadge" and
// "AttachmentViewer" (also named in §7) are not built at all this volume —
// Labels and Attachments have zero backend support (see docs/TECH-DEBT.md).
// "AutomationCard" isn't built either — Automation is presented as a single
// Settings form (Card + Switch + Textarea, all pre-existing), not a list of
// cards, since the backend exposes one Settings object, not named rules
// (ADR-FE-008).

export * from "./components/revenue-chart";
export * from "./components/stage-badge";
export * from "./components/probability-badge";
export * from "./components/lead-card";
export * from "./components/customer-card";
export * from "./components/deal-card";
export * from "./components/deal-tile";
export * from "./components/pipeline-column";
export * from "./components/activity-card";
export * from "./components/timeline";

// FRD-001 Volume-5 — the 9 above are CRM UI's presentational primitives
// (§7: LeadCard, CustomerCard, DealCard, DealTile, PipelineColumn,
// ActivityCard, Timeline, StageBadge, ProbabilityBadge — every §7 name is
// built). RevenueChart is the first consumer of Recharts (DS-001 §10's
// pre-approved chart library, installed this volume) — one flexible
// bar/line/pie primitive covers all 5 chart types §10 names, rather than
// 5 bespoke components. ReportCard/ForecastCard (also named in §7) are
// deliberately NOT built — the existing Volume-3 `SummaryCard` already
// covers "label + value + description," so building near-duplicates would
// have violated the "don't add abstractions beyond what's needed"
// principle; Reports/Forecast screens reuse SummaryCard directly. Forms
// (Lead/Customer/Deal edit forms, Activity/Note composer) stay
// app-specific in apps/web/src/features/crm/, same reasoning as every
// prior volume's forms — see docs/ADR-FE-009-crm-ui-strategy.md.

export * from "./components/usage-progress";
export * from "./components/feature-limit-card";
export * from "./components/plan-card";
export * from "./components/invoice-card";
export * from "./components/payment-card";
export * from "./components/settings-section";
export * from "./components/preference-card";
export * from "./components/integration-card";
export * from "./components/api-key-card";
export * from "./components/webhook-card";
export * from "./components/export-job-card";
export * from "./components/health-status-card";

// FRD-001 Volume-7 — Settings UI's presentational primitives. §7 also names
// BrandingCard, SessionCard, and LoginHistoryTable, but none of the three
// were built this volume — Workspace Settings/Branding/Notifications/
// Security are NOT rebuilt (Settings Home links to the existing, already
// shipped and frozen /workspace/* and /profile/* pages instead — see
// docs/ADR-FE-013-settings-ui-strategy.md), and SessionCard/
// LoginHistoryTable already exist from FRD-001 Volume-2, reused there
// unchanged, never duplicated here. "AuditTimeline" (also named in §7) was
// not built as a separate component either — the Audit Logs screen
// composes the existing Timeline/TimelineItem primitives (Volume-5)
// directly, matching the ReportCard/ForecastCard precedent of not building
// a near-duplicate wrapper.

// FRD-001 Volume-6 — Billing UI's presentational primitives. §7 names
// "UsageCard" and "FeatureLimitCard" as separate components describing the
// same shape (one feature/counter's usage at a glance) — only
// FeatureLimitCard was built, matching the ReportCard/ForecastCard
// precedent above. "RevenueCard"/"ForecastCard" (also named in §7) are
// likewise not built — both are exactly SummaryCard's "label + value +
// description" shape, reused directly on the Reports/Forecast screens.
// "SubscriptionBadge" isn't built either — `StageBadge` (Volume-5) is
// already a generic "any status string via getStatusColor" wrapper, reused
// as-is for SubscriptionStatus/InvoiceStatus/PaymentStatus.
// "BillingHistoryTimeline" is not built at all — the Billing History
// Timeline screen was dropped this volume (no tenant-facing endpoint
// exists, see docs/TECH-DEBT.md). See
// docs/ADR-FE-011-billing-ui-strategy.md.
