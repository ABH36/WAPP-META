# Design System

**Status:** Accepted
**Date:** 2026-08-10
**Scope:** FRD-001 Volume-1 §6/§20 — Design System & Design Tokens. What this volume adds to `packages/ui` against DS-001 (Design Foundation), and what stays deliberately deferred to later modules.
**Implemented in:** `packages/ui/src/components/{header,sidebar,breadcrumb,footer,skeleton,empty-state}.tsx`, `packages/ui/src/index.ts`

## Approving FRD-001 Volume-1 also finalizes the DS-001 sections it depends on

`docs/design-system/DS-001-design-foundation.md` was still "Draft for Approval" when this volume began. Architecture Review, 2026-08-10, resolved (per the recommended option) that FRD-001 Volume-1's approval simultaneously ratifies the DS-001 content it draws from — §2/§3 (color/typography/spacing/radius/shadow/motion tokens), §4 (the Layout System component specs this volume implements), §5 (the Layout System structure), and §12 (the Next.js mapping table) are now load-bearing, not still-draft. Sections of DS-001 this volume doesn't touch (§6's full Page Template inventory, §11's Figma organization) remain exactly as draft as they were — this approval doesn't blanket-freeze the entire document, only the parts FRD-001 Volume-1 actually implements.

## Design tokens were already fully implemented before this volume — nothing new to add

`packages/ui/tailwind.preset.ts` already matched DS-001 §2/§3 verbatim (neutral/brand/semantic color ramps, `display`/`h1`–`h3`/`body`/`caption` type scale, radius/shadow/transition-duration tokens) — built in an earlier "Phase 1 Foundation" pass this volume inherited rather than created. `getStatusColor()` (`packages/ui/src/lib/status-color.ts`) already implements DS-001 §2.1's business-state → color mapping table exactly, with one deliberate deviation from DS-001 §12's own text: DS-001 §12 says this utility should live in `packages/shared-types`; it actually lives in `packages/ui`. This is the correct call, not a bug to fix — `packages/shared-types` is framework-agnostic, consumed by `apps/api` too, and has zero business owning `getStatusColor`'s purely presentational concern (which Tailwind class token a status maps to); `packages/ui` is where every other DS-001 §4 component lives.

## The six Layout System primitives DS-001 §4/§5 actually requires this volume

`Header`, `Sidebar`+`SidebarItem`, `Breadcrumb`, `Footer`, `Skeleton`+`SkeletonText`+`SkeletonCard`, `EmptyState` — every one a pure layout/structural shell (slots for app-specific content), never hardcoding navigation items, page copy, or business data. This follows `Button`'s own established pattern exactly (`packages/ui/src/index.ts`'s pre-existing comment: "the reference pattern every subsequent component follows") — `cva` for variants where relevant, `forwardRef`, DS-001 token classes only, never a raw hex/px value inline.

`EmptyState` is deliberately reused as-is for both its DS-001-named purpose ("icon + one-sentence explanation + primary CTA... never a blank page" — empty lists/tables) and for the root `error.tsx`/`not-found.tsx` pages in both apps — same shape (icon/title/description/action), different icon and copy, not a second component. `Footer`'s DS-001 note ("not present inside the authenticated app") is enforced by omission, not by a prop: `apps/admin` never imports it at all, and `apps/web`'s `(workspace)` layout doesn't either — only a future Public Website page would.

## `PlatformHeader`'s distinguished color is the one place DS-001 §5's Platform-Administration row gets implemented

DS-001 §5: "visually distinguished top bar color to prevent an admin ever confusing which console they're in." `apps/admin/src/components/layout/platform-header.tsx` overrides `Header`'s default (theme-following `neutral-0`/`neutral-950`) with a fixed `bg-neutral-900` regardless of light/dark mode — a Platform Administrator's screen always has a dark top bar, a constant visual signal independent of their personal theme preference. `apps/web`'s `WorkspaceHeader` uses `Header`'s default, unmodified.

## Everything else in DS-001 §4's full inventory is explicitly deferred, not missing

Input, Select, Table, Card, Badge, Modal, Toast, Tabs, and the rest of DS-001 §4's ~30-component table are not built this volume. This matches the pre-existing convention `packages/ui/src/index.ts`'s own comment already established before this volume began ("Additional components... are added incrementally, one per module's frontend implementation step... not all at once in Phase 1 Foundation") — Volume-1's job is the six structural primitives the app _shell_ itself needs to render and be navigable; form inputs, data tables, and dialogs are each a future module's own concern, added when that module's real screens need them, per DS-001 §13's own governance rule ("No new component is created without checking Section 4 first... if something new is genuinely needed, it gets added to this document... before being built, not after" — the inventory in §4 already anticipates them, this volume just hasn't built them yet).
