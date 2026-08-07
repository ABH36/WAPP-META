# Activity Permission Strategy

**Status:** Accepted
**Date:** 2026-08-07
**Scope:** PRD-004 Volume-5 — how Activity access is authorized, factored out of `docs/ADR-CRM-016-activity-ownership-strategy.md` into its own document per Architecture Review recommendation
**Implemented in:** `apps/api/src/modules/crm/services/activity.service.ts`, `controllers/activity.controller.ts`

## The inheritance table

No `VIEW_ACTIVITIES`/`CREATE_ACTIVITIES`-style permission exists anywhere in `permission.enum.ts`, and none was added. An Activity's authorization is entirely derived from whichever Customer and/or Deal it references:

| Operation                                                                     | Customer reference requires | Deal reference requires |
| ----------------------------------------------------------------------------- | --------------------------- | ----------------------- |
| View (`getById`, and the broader gate on `list`)                              | `VIEW_CUSTOMERS`            | `VIEW_DEALS`            |
| Create / general update / assign / Task status / Follow-up complete / archive | `EDIT_CUSTOMER`             | `CREATE_DEALS`          |

`CREATE_DEALS` — not a hypothetical `EDIT_DEALS` — is deliberate: Part-4 already established `CREATE_DEALS` as the permission gating Deal's own general updates and assignment (`docs/ADR-CRM-012-deal-lifecycle-strategy.md`), so reusing it here keeps one permission meaning one thing platform-wide, rather than introducing a second permission that would gate the identical capability on a different route.

If an Activity references both a Customer and a Deal, the actor needs the applicable permission for **both** — not "either." This is the conservative reading: granting access via only one reference would let, say, an actor with Deal access but no Customer access read/write Customer-linked data simply because the same Activity happens to also reference a Deal.

## Why no permission was added, even though every other CRM entity has one

Customer has `VIEW_CUSTOMERS`/`CREATE_CUSTOMER`/`EDIT_CUSTOMER`. Lead has `VIEW_LEADS`/`CREATE_LEADS`/`UPDATE_LEAD_STAGE`/`CONVERT_LEADS`. Deal has `VIEW_DEALS`/`CREATE_DEALS`/`CLOSE_DEALS`. Activity breaks that pattern on purpose: it's the only CRM entity with no independent business meaning of its own — a Task about nothing (no Customer, no Deal) isn't a valid Activity at all (BR-003 requires at least one reference). Its entire reason for existing is to record something about a Customer or a Deal, so gating it by permissions that already answer "can this actor touch that Customer/Deal" is the more accurate model, not a shortcut — a would-be `VIEW_ACTIVITIES` permission would just be redundant with `VIEW_CUSTOMERS`/`VIEW_DEALS` and could drift out of sync with them over time (e.g. someone grants `VIEW_ACTIVITIES` to a role without also granting `VIEW_CUSTOMERS`, producing an actor who can see a Task's existence but not the Customer it's about).

## Where the checks actually live: inline, not `@RequirePermission`

Every other controller in this codebase decorates routes with a static `@RequirePermission(Permission.X)` — correct wherever the permission is fixed by the route itself. It can't work that way here: which permission applies depends on the specific document's `customerId`/`dealId`, known only after (or, for creation, from) the request's own data. `ActivityController` therefore carries zero `@RequirePermission` decorators; every authorization decision happens inside `ActivityService`, via a private `ensureAccess`/`ensureAccessForActivity` pair that checks `getPermissionLevel(actorRole, permission) === PermissionLevel.NONE` for each present reference.

This extends a technique this codebase already used twice at smaller scale — `ConversationService.assign` checks `REPLY_CONVERSATIONS` inline for an assignee's eligibility; `DealService.updateStage` checks `CLOSE_DEALS` inline only when the target stage is terminal. Activity is the first place this inline technique drives _all_ authorization for an entire controller, not one sub-case within an otherwise-decorated route.

## List access is coarser than single-record access

`VIEW_CUSTOMERS`/`VIEW_DEALS` are workspace-wide capabilities in this codebase's permission model — not per-record ACLs. No existing list endpoint (Customer, Lead, Deal) filters rows by anything finer-grained than the base permission. `ActivityService.list()` matches that: it requires the actor hold _at least one_ of `VIEW_CUSTOMERS`/`VIEW_DEALS` to call the endpoint at all, then returns matching rows without per-row filtering by which reference type each one has. Getting or mutating one _specific_ Activity still applies the precise per-reference table above — only the list-level entry gate is coarser, and only to stay consistent with how every other list endpoint in this codebase already behaves.

Worth naming plainly: under the current permission matrix, `VIEW_CUSTOMERS` has no `NONE` grant for any `TenantRole` — every role has at least `VIEW_ONLY`. So today, `list()`'s rejection can only actually fire when `actorRole` is `null` (no workspace membership). That's a property of today's grant table, not a flaw in the check — the logic starts actively filtering the moment a future permission-matrix change ever tightens `VIEW_CUSTOMERS` down to `NONE` for some role.
