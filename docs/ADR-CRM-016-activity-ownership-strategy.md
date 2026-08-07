# Activity Ownership Strategy

**Status:** Accepted
**Date:** 2026-08-07
**Scope:** PRD-004 Volume-5 §3/§19 — Activities reference Customer and Deal, never own them
**Implemented in:** `apps/api/src/modules/crm/schemas/activity.schema.ts`, `services/activity.service.ts`, `controllers/activity.controller.ts`

## References, not ownership

§19 states Activities "shall never own Customer, own Deal, modify Customer, [or] modify Deal." Structurally, `Activity.customerId`/`Activity.dealId` are plain nullable references (Mongoose `ref`, populated only for lookup) — `ActivityService` never writes to a `Customer` or `Deal` document, the same one-directional-reference discipline already established for Lead→Contact/Customer (`docs/ADR-CRM-006-lead-ownership-strategy.md`) and Deal→Contact/Customer/Lead (`docs/ADR-CRM-010-deal-creation-boundary.md`). §5/BR-003 requires at least one of the two references; both may be set together (an Activity tied to a specific Deal _and_ its Customer) — nothing in Volume-5 forbids that, and `validateReferences` doesn't reject it.

Unlike every prior CRM entity, Activity has no reference to Contact at all — it's an operational/timeline record, not an identity record, and has no need for the Contact-resolution machinery Customer/Lead/Deal all share (`findOrCreate`, dedup-by-phone-number, etc.).

## No dedicated Activities permission — and what that means for enforcement

No `VIEW_ACTIVITIES`/`CREATE_ACTIVITIES`-style permission exists in `permission.enum.ts`, and none was added (resolved during Architecture Review): an Activity's access is inherited from whichever record it references —

| Operation                                  | Customer reference | Deal reference                                                  |
| ------------------------------------------ | ------------------ | --------------------------------------------------------------- |
| View (`getById`, `list`)                   | `VIEW_CUSTOMERS`   | `VIEW_DEALS`                                                    |
| Create/Edit/Assign/Status/Complete/Archive | `EDIT_CUSTOMER`    | `CREATE_DEALS` (already gates Deal's own general edits, Part-4) |

If an Activity references both, the actor needs the required permission for _both_ references, not just one — the more conservative, least-privilege reading, since requiring only one would let an actor with Deal access but no Customer access see/edit Customer-linked data through an Activity that happens to also reference a Deal.

## A genuinely new pattern: no `@RequirePermission` anywhere in `ActivityController`

Every other controller in this codebase gates routes with a static `@RequirePermission(Permission.X)` decorator — the permission is fixed by the route. Activity can't work that way: which permission applies depends on the specific document's `customerId`/`dealId`, not on which URL was hit. `ActivityController` therefore has zero `@RequirePermission` decorators; every check happens inline in `ActivityService`, after (or, for creation, using) the actual reference data — extending the inline-check technique already used twice before (`ConversationService.assign` checking `REPLY_CONVERSATIONS` for an assignee's eligibility; `DealService.updateStage` checking `CLOSE_DEALS` only for terminal targets), but for the first time driving the _entire_ authorization decision for a whole controller, not just one sub-case within an otherwise-decorated route.

## List-level access is coarser than record-level access, deliberately

`VIEW_CUSTOMERS`/`VIEW_DEALS` are workspace-wide capabilities in this codebase's existing permission model, not per-record ACLs — every Customer is visible to anyone holding `VIEW_CUSTOMERS`, with no finer-grained row filtering anywhere (Customer/Lead/Deal's own list endpoints already work this way). `ActivityService.list()` therefore only checks that the actor holds _at least one_ of `VIEW_CUSTOMERS`/`VIEW_DEALS` — not per-row — and returns matching Activities without further filtering by reference type. Getting/mutating one _specific_ Activity still uses the precise per-reference check above; only the list-level gate is coarser, and only because nothing else in this codebase does row-level filtering to be consistent with.

One consequence worth naming: with the current permission matrix, `VIEW_CUSTOMERS` has no `NONE` grant for any `TenantRole` (every role has at least `VIEW_ONLY`) — so today, `list()`'s rejection branch is only reachable when `actorRole` is `null` (no workspace membership at all). This isn't a bug in the check; it's a property of the current grant table, and the logic stays correct (and starts actively filtering) if a future permission-matrix change ever tightens `VIEW_CUSTOMERS` down to `NONE` for some role.
