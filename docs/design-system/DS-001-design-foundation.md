# DS-001 — WAPP Design Foundation

**Version:** 1.0 | **Status:** Draft for Approval | **Stack target:** Next.js 15 (App Router) + Tailwind CSS + shadcn/ui + Framer Motion

**Scope note:** This is a text-based, implementation-ready specification — design tokens, component specs, and layout rules that a developer can translate directly into `tailwind.config.ts` and shadcn/ui components, and that a designer can use as the single source of truth for building the actual Figma file. This document does not itself produce a `.fig` file — Section 11 defines exactly how that Figma file should be structured once someone builds it from this spec.

**Traceability:** Every page/screen listed in Section 6 traces to a specific PRD. No page is invented beyond what PRD-001–008 define. No visual decision here overrides any approved business rule — where a component displays business data (e.g., Workspace Status, Lead Status), the state values themselves come from BRD-001/PRD-004/PRD-005, this document only defines how they're _presented_.

---

## 1. Design Language

**Positioning:** Premium Enterprise SaaS — closer to Linear, Retool, and Vercel's dashboard than to a typical Indian SMB tool. This is the direct execution of D008/D009 (compete on usability, not feature count) and the Vision doc's "cleanest UI, fastest workflow" differentiator.

| Principle                               | Means                                                                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Clean                                   | Generous whitespace, no decorative chrome, content leads                                                                                                                 |
| Modern                                  | Neutral base palette + single confident accent, not multi-color "dashboard soup"                                                                                         |
| Minimal                                 | Every screen has one primary action; secondary actions are visually quieter                                                                                              |
| High information density (where needed) | Inbox, CRM tables, and Reports favor compact, scannable density — density is a _feature_ for power users, not a compromise                                               |
| Responsive                              | Mobile-first for Public Website and Auth; desktop-first (with functional mobile) for the workspace application, since SLA-monitoring/CRM/Inbox work is primarily desktop |
| Accessible                              | WCAG AA is a floor, not a stretch goal (Section 10)                                                                                                                      |

---

## 2 & 3. Brand Identity & Design Tokens

All values below are the literal `tailwind.config.ts` token source.

### 2.1 Color System

Neutral-first palette with one accent. Full 50–950 ramps for both light and dark themes (the app must support OS-level dark mode from day one — cheap now, expensive to retrofit).

```
// Neutral (slate-based, used for 90% of the UI: backgrounds, borders, text)
neutral: {
  0:  '#FFFFFF',
  50: '#F8FAFC', 100: '#F1F5F9', 200: '#E2E8F0', 300: '#CBD5E1',
  400:'#94A3B8', 500:'#64748B', 600:'#475569', 700:'#334155',
  800:'#1E293B', 900:'#0F172A', 950:'#020617'
}

// Brand / Accent (primary actions, links, active states)
brand: {
  50:'#EEF2FF', 100:'#E0E7FF', 200:'#C7D2FE', 300:'#A5B4FC',
  400:'#818CF8', 500:'#6366F1', // <- primary brand color
  600:'#4F46E5', 700:'#4338CA', 800:'#3730A3', 900:'#312E81'
}

// Semantic
success: { 50:'#F0FDF4', 500:'#22C55E', 700:'#15803D' }
warning: { 50:'#FFFBEB', 500:'#F59E0B', 700:'#B45309' }
danger:  { 50:'#FEF2F2', 500:'#EF4444', 700:'#B91C1C' }
info:    { 50:'#EFF6FF', 500:'#3B82F6', 700:'#1D4ED8' }
```

**Business-state color mapping** (so every status badge in the app is visually consistent — this maps directly to the enums already approved in the PRDs, e.g. `LeadStatus`, `WorkspaceStatus`, `DealStage`, `TicketStatus`):

| Semantic meaning                      | Token         | Applies to (examples)                                               |
| ------------------------------------- | ------------- | ------------------------------------------------------------------- |
| Positive / Won / Active / Paid        | `success`     | Deal Won, Workspace Active, Payment Paid                            |
| Attention / Pending / Trial           | `warning`     | Trial, Pending Customer, Payment Failed (grace period)              |
| Negative / Lost / Suspended / Expired | `danger`      | Deal Lost, Workspace Suspended/Expired, Payment Failed (post-grace) |
| Neutral / Informational               | `info`        | New, Draft, Scheduled                                               |
| Inactive / Archived                   | `neutral-400` | Closed, Archived, Cancelled                                         |

Dark mode: neutral ramp inverts (950→0 becomes the background→foreground direction); brand/semantic hues stay the same but shift one step lighter (400 instead of 500) for sufficient contrast on dark backgrounds.

### 2.2 Typography

Font: **Inter** (variable), fallback `system-ui`. One typeface, weight does the work — no secondary display font, consistent with "no marketing exaggeration" (WP-004).

| Token     | Size / Line-height | Weight | Use                                   |
| --------- | ------------------ | ------ | ------------------------------------- |
| `display` | 36px / 44px        | 700    | Marketing hero headlines only         |
| `h1`      | 28px / 36px        | 700    | Page titles                           |
| `h2`      | 22px / 30px        | 600    | Section headings                      |
| `h3`      | 18px / 26px        | 600    | Card/panel headings                   |
| `body-lg` | 16px / 24px        | 400    | Marketing body copy                   |
| `body`    | 14px / 20px        | 400    | Default app UI text                   |
| `body-sm` | 13px / 18px        | 400    | Table cells, metadata, secondary text |
| `caption` | 12px / 16px        | 500    | Labels, badges, timestamps            |
| `mono`    | 13px / 20px        | 400    | IDs, tokens, code (JetBrains Mono)    |

### 2.3 Spacing

4px base unit, exposed as Tailwind's default scale (`1`=4px … `20`=80px). Component-internal padding standardizes on `4` (16px) for cards/panels, `2` (8px) for compact table rows, `6` (24px) for page-section gaps.

### 2.4 Radius

| Token         | Value  | Use                      |
| ------------- | ------ | ------------------------ |
| `radius-sm`   | 6px    | Badges, chips, inputs    |
| `radius-md`   | 8px    | Buttons, cards           |
| `radius-lg`   | 12px   | Modals, panels           |
| `radius-full` | 9999px | Avatars, pills, switches |

### 2.5 Elevation / Shadows

Flat by default (enterprise SaaS ≠ heavy skeuomorphism). Shadows exist only to indicate _layering_ (something floats above the page), never for decoration.

| Token       | Use                    |
| ----------- | ---------------------- |
| `shadow-xs` | Dropdowns, popovers    |
| `shadow-sm` | Cards on hover         |
| `shadow-md` | Modals, drawers        |
| `shadow-lg` | Toasts (highest layer) |

### 2.6 Iconography

**Lucide Icons** — this is the shadcn/ui default, zero extra dependency, consistent stroke-width (1.75px) across the whole product. No mixed icon sets. Icon sizes: `16px` (inline/inputs), `20px` (buttons, nav), `24px` (empty states, feature highlights).

### 2.7 Motion Principles

Framer Motion, per TAD-001. Motion communicates _state change_, never decoration:

- **Duration:** 150ms (micro: hover/focus) / 200ms (component: dropdown/modal) / 300ms (page transitions) — never slower, this is a productivity tool, not a marketing showcase.
- **Easing:** `ease-out` for entrances, `ease-in` for exits.
- **Reduced motion:** every animation respects `prefers-reduced-motion` — disable non-essential motion entirely, don't just shorten it.

---

## 4. Complete Component Library

Every component below maps to a shadcn/ui primitive (extended, not replaced) unless noted. States listed are the ones every interactive component must implement — see Section 8 for the full state matrix.

| Component            | shadcn/ui base                                                                   | Variants                                     | Notes                                                           |
| -------------------- | -------------------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------- |
| Button               | `button`                                                                         | primary, secondary, ghost, destructive, link | icon-only variant uses 32×32 hit target min                     |
| Input                | `input`                                                                          | default, with-icon, with-addon               | error state = `danger-500` border + helper text                 |
| Textarea             | `textarea`                                                                       | default, auto-resize                         | used in Internal Notes, Broadcast composer                      |
| Select               | `select`                                                                         | single, searchable (Combobox)                | searchable required for Customer/Lead pickers                   |
| Checkbox             | `checkbox`                                                                       | default, indeterminate                       | indeterminate = bulk-select "some selected"                     |
| Radio Group          | `radio-group`                                                                    | default                                      | Plan selection, Lost Reason picker                              |
| Switch               | `switch`                                                                         | default                                      | Notification toggles, feature flags                             |
| Table                | `table` (custom data-table)                                                      | default, selectable, expandable              | powers Customers/Leads/Deals/Conversations lists                |
| Card                 | `card`                                                                           | default, interactive (hover-elevate)         |                                                                 |
| Badge                | `badge`                                                                          | success/warning/danger/info/neutral          | maps to Section 2.1 status colors                               |
| Chip / Tag           | custom (badge-derived)                                                           | removable, static                            | Customer Tags, Labels                                           |
| Avatar               | `avatar`                                                                         | with-status-dot                              | status dot = agent online/away, per future presence feature     |
| Dropdown Menu        | `dropdown-menu`                                                                  | default                                      | row actions, user menu                                          |
| Sidebar              | custom                                                                           | collapsed, expanded                          | see Section 5                                                   |
| Header / Topbar      | custom                                                                           | app, marketing                               |                                                                 |
| Footer               | custom                                                                           | marketing only                               | not present inside the authenticated app                        |
| Navigation (top nav) | custom                                                                           | marketing                                    |                                                                 |
| Breadcrumbs          | `breadcrumb`                                                                     | default                                      | CRM detail drill-down                                           |
| Tabs                 | `tabs`                                                                           | default, pill                                | Customer detail (Overview/Activities/Deals/Conversations)       |
| Accordion            | `accordion`                                                                      | default                                      | FAQ, Settings sub-sections                                      |
| Timeline             | custom                                                                           | default                                      | Customer/Lead/Deal Timeline (PRD-004)                           |
| Modal / Dialog       | `dialog`                                                                         | default, confirm (destructive)               | Convert Lead, Suspend Workspace confirmations                   |
| Drawer / Sheet       | `sheet`                                                                          | right-side                                   | Conversation detail on mobile, filters panel                    |
| Tooltip              | `tooltip`                                                                        | default                                      | icon-only buttons always get a tooltip                          |
| Popover              | `popover`                                                                        | default                                      | Date range picker, quick filters                                |
| Toast                | `sonner` (shadcn-recommended)                                                    | success/error/info                           | non-blocking, auto-dismiss 4s                                   |
| Alert / Banner       | `alert`                                                                          | info/warning/danger, dismissible             | Workspace expiring, Trial ending banners                        |
| Empty State          | custom                                                                           | with-illustration, with-CTA                  | see Section 8                                                   |
| Skeleton Loader      | `skeleton`                                                                       | text, card, table-row                        | matches the shape of the content it replaces                    |
| Charts               | Recharts (via shadcn `chart`)                                                    | line, bar, donut                             | Reports & Analytics, Campaign Analytics                         |
| Form                 | `form` (react-hook-form + zod, shared with backend DTOs via `shared-validation`) | default                                      |                                                                 |
| Search               | `input` + `command` (Cmd-K)                                                      | inline, global                               | Global search = Cmd-K palette                                   |
| Filters              | custom (popover + chips)                                                         | default                                      | applied filters shown as removable chips                        |
| Pagination           | `pagination`                                                                     | default, load-more (Inbox)                   | data tables use numbered pagination; Inbox uses infinite scroll |
| File Upload          | custom (react-dropzone)                                                          | default, image-preview                       | Broadcast media, Logo upload                                    |
| Date Picker          | `calendar` + `popover`                                                           | single, range                                | Follow-up due date, Report date range                           |
| Status Indicator     | Badge-derived                                                                    | dot, pill                                    | Connection status (WhatsApp), Workspace Status                  |
| Progress             | `progress`                                                                       | linear, circular                             | Broadcast send progress, Onboarding checklist                   |

---

## 5. Layout System

| Area                            | Structure                                                                                                                                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Marketing Website**           | Sticky top nav + footer, max-width 1280px content, full-bleed hero                                                                                                                                                                          |
| **Dashboard (workspace home)**  | Persistent left sidebar (collapsible) + topbar (workspace switcher — future multi-workspace, search, notifications, user menu) + content area with widget grid                                                                              |
| **CRM (Customers/Leads/Deals)** | Sidebar + list/table view with right-side detail drawer (avoids full navigation away from the list — critical for high-volume Sales Executive workflows)                                                                                    |
| **WhatsApp Inbox**              | 3-pane: conversation list (left) / active conversation (center) / customer context panel (right, collapsible) — this is the highest-density, most-used screen in the product and gets the most layout investment                            |
| **Broadcast**                   | Wizard layout (stepper: Audience → Template → Schedule → Review) rather than a single long form                                                                                                                                             |
| **Billing**                     | Sidebar + single-column settings-style layout, plan comparison as a 3-card grid                                                                                                                                                             |
| **Workspace Settings**          | Sidebar + settings sub-nav (tabs) + form panels                                                                                                                                                                                             |
| **Platform Administration**     | Separate app shell entirely (per SDP-001 §3) — same design tokens, distinct navigation (no workspace switcher, has tenant search instead), visually distinguished top bar color to prevent an admin ever confusing which console they're in |

---

## 6. Page Templates

Every page below traces to its PRD. No page is invented.

<details>
<summary><b>Public Website (PRD-008, Vols 1–4)</b></summary>

Home · Features · Pricing · Industries · Integrations · About · Contact · FAQ · Blog (index + article) · Documentation (index + article) · Release Notes · Changelog · Trust Center · Privacy Policy · Terms of Service · Refund Policy · Cookie Policy

Template: marketing layout (Section 5), each following the section structure already specified in PRD-008 Vol 2 §4 (Hero → Overview → Benefits → Features → Use Cases → Testimonials → FAQ → Final CTA for Home; equivalent structures per page as PRD-008 defines).
</details>

<details>
<summary><b>Authentication (PRD-002)</b></summary>

Register · Verify Email · Login · Forgot Password · Reset Password · Workspace Creation · Company Profile setup · Trial Activation confirmation · Team Invitation acceptance

Template: centered single-column card, max-width 420px, no sidebar/nav chrome — minimizes distraction on the highest-drop-off screens in the product (consistent with D015's 30-minute activation goal).
</details>

<details>
<summary><b>Workspace App — Inbox & Communication (PRD-003)</b></summary>

Shared Inbox (3-pane, §5) · Personal Inbox · Conversation detail · WhatsApp Connection wizard · Phone Number management · Template Management (list + create/submit) · Broadcast (list + wizard) · Campaign (list + builder, segmentation, monitoring, analytics) · Automation settings (Business Hours, Welcome/Away, Auto-Assignment, SLA, Escalation)
</details>

<details>
<summary><b>Workspace App — CRM (PRD-004)</b></summary>

Customer list + detail (Overview/Timeline/Activities/Deals/Conversations tabs) · Lead list (table + Kanban-by-status) + detail · Deal Pipeline (Kanban by stage) + detail · Activities/Tasks/Notes/Follow-ups (unified panel per SAD-002's discriminated `activities` model — one UI list, filterable by type)
</details>

<details>
<summary><b>Workspace App — Billing & Settings (PRD-005, PRD-006)</b></summary>

Plan & Billing overview · Plan comparison/upgrade · Invoices list + detail · Payment method · Workspace Lock Screen (Expired/Suspended states) · Business Profile · Workspace Preferences · Business Hours · Notification Settings · Security Settings (password, sessions) · Team Management (Members list, Invite, Roles)
</details>

<details>
<summary><b>Platform Administration (PRD-007)</b></summary>

Platform Dashboard · Workspace list + detail · Subscription Management · Payment Monitoring · Invoice Management · Trial Administration · Support Center (workspace search, Temporary Access request/approval) · Global Audit (search/filter) · Platform Reports · Platform Alerts
</details>

---

## 7. Responsive Rules

| Breakpoint | Width      | Behavior                                                                                                                                                                               |
| ---------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile     | < 640px    | Marketing site: fully responsive. Workspace app: sidebar collapses to bottom-nav/drawer, Inbox drops to single-pane (list → conversation, back-navigable), tables become stacked cards |
| Tablet     | 640–1024px | Sidebar auto-collapses to icon-only; Inbox becomes 2-pane (list+conversation, context panel becomes a drawer)                                                                          |
| Desktop    | > 1024px   | Full 3-pane Inbox, full sidebar, side-drawer detail panels for CRM                                                                                                                     |

Public Website is mobile-first by construction; the authenticated workspace app is desktop-first with full mobile functionality (not degraded), consistent with the primary beachhead (B2B trading/distributor staff) working mainly from desktop but needing mobile access for on-the-go replies.

---

## 8. Interaction Rules

State matrix every interactive component must implement:

| State       | Rule                                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hover       | `neutral-100`/`brand-50` background shift, 150ms, cursor pointer on all actionable elements                                                                                          |
| Focus       | Visible focus ring (`ring-2 ring-brand-500`) on every focusable element — never `outline: none` without a replacement (WCAG requirement, Section 10)                                 |
| Loading     | Skeleton for initial load; inline spinner + disabled state for in-flight actions (never a full-page blocking spinner for anything shorter than a full navigation)                    |
| Success     | Toast (non-blocking) + inline checkmark for form fields where relevant                                                                                                               |
| Error       | Inline field-level error (red border + message) for validation; toast for request-level failures; never a raw stack trace or backend message (ties to TAD-001 ERR-002)               |
| Disabled    | 40% opacity, cursor `not-allowed`, no hover state                                                                                                                                    |
| Empty State | Every list/table has a designed empty state: icon + one-sentence explanation + primary CTA (e.g., empty Leads list → "No leads yet" + "Create your first lead") — never a blank page |

---

## 9. Animation Standards

Framer Motion, governed by Section 2.7. Standard patterns:

- **Page/route transition:** fade + 8px slide, 200ms
- **Modal/Drawer:** scale-from-98% + fade (modal), slide-from-edge (drawer), 200ms
- **Toast:** slide-in from bottom-right, auto-exit after 4s
- **List item add/remove:** height + opacity animate (`AnimatePresence`), 150ms — critical for Inbox (new message arriving) and Kanban (deal moved between stages)
- **Kanban drag:** native drag feedback (elevation + slight rotation), snap-back on invalid drop

---

## 10. Accessibility — WCAG AA (mandatory floor)

- Minimum contrast 4.5:1 (body text), 3:1 (large text/icons) — verified against every token pair in Section 2.1 before implementation.
- Full keyboard navigation: every action reachable via Tab/Enter/Escape, no mouse-only interactions.
- All form inputs have associated `<label>`; all icon-only buttons have `aria-label` (this is the same rule as TAD-001's DTO validation — enforced at the component level, not left to individual screens).
- Focus trapping in Modals/Drawers; focus returns to the trigger element on close.
- Screen-reader-only text (`sr-only`) for status changes announced via `aria-live` (e.g., "Broadcast sending: 340 of 1,000 sent").

---

## 11. Figma Organization

For the design team building the actual Figma file from this spec:

```
📁 WAPP Design System
 ├── 📄 Cover & Changelog
 ├── 📄 Foundations (Color, Type, Spacing, Radius, Elevation, Icons — as Figma Variables, mirroring Section 2/3 tokens exactly)
 ├── 📄 Components (one frame per component in Section 4, each with all variants as Figma Component Variants, not duplicated frames)
 ├── 📄 Patterns (composed patterns: table+filters, form+validation, empty states)
 ├── 📄 Templates — Marketing (one page per Section 6 marketing page)
 ├── 📄 Templates — Auth
 ├── 📄 Templates — Workspace App
 ├── 📄 Templates — Platform Admin
 └── 📄 Prototypes (interactive flows: Onboarding, Lead Conversion, Broadcast wizard)
```

**Naming convention:** `Component/Variant/State` (e.g., `Button/Primary/Hover`), Auto Layout on every frame (no manual positioning — ensures 1:1 translation to Tailwind flex/grid), Figma Variables bound to the exact token names in Section 2/3 so a token change updates every instance.

---

## 12. Next.js Mapping

| Design concept                       | Implementation                                                                                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Design tokens (Section 2/3)          | `tailwind.config.ts` theme extension, values copied verbatim                                                                            |
| Components (Section 4)               | `packages/ui/src/components/*` — shadcn/ui CLI-generated base, customized to match tokens, consumed by both `apps/web` and `apps/admin` |
| Business-state → color mapping (2.1) | A single `getStatusColor(status: LeadStatus                                                                                             | WorkspaceStatus | ...)`utility in`packages/shared-types`, so status-color logic exists in exactly one place, never duplicated per screen |
| Layouts (Section 5)                  | Next.js route-group layouts (`app/(workspace)/layout.tsx` etc.)                                                                         |
| Motion (Section 9)                   | Framer Motion `variants` objects co-located with each component, not inlined per usage                                                  |

---

## 13. Design Governance

- **No screen ships without a corresponding entry in Section 6.** If a screen is needed that isn't listed there, that's a signal a PRD is missing something — stop and raise it as a planning question, don't design around it silently (same discipline as TPH-006).
- **No new component is created without checking Section 4 first.** A "one-off" component is a maintenance liability; if something new is genuinely needed, it gets added to this document (versioned, DS-001 v1.1+) before being built, not after.
- **Design token changes require a version bump to this document**, the same way a business rule change requires an ADR. Tokens are not edited ad hoc inside component code.
- **Ownership:** whoever holds "UI/UX Architect" responsibility (per the original team-constitution role list) owns this document going forward and is the approval gate for any deviation.
