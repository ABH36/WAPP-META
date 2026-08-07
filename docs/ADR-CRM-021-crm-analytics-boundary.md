# CRM Analytics Boundary

**Status:** Accepted
**Date:** 2026-08-07
**Scope:** The permanent, module-wide separation between transactional CRM data (Parts 1–5) and analytical reporting (Part 6) — a capstone document for the whole CRM module, not just Part-6's own implementation
**Implemented in:** `apps/api/src/modules/crm/` (all of it — this document describes a boundary the whole module observes, not one file)

## The boundary, stated once, for the whole module

CRM's five transactional Parts (Customer, Lead, Lead Conversion, Deal, Activities/Tasks/Follow-ups/Notes) each own exactly one collection, write to it through exactly one service, and never aggregate across entities — every list/search endpoint in Parts 1–5 queries its own collection's native fields (`docs/ADR-CRM-016`, `docs/ADR-CRM-017`; the one deliberate exception, Activity referencing Customer/Deal, is a read-only reference, never a write — `docs/ADR-CRM-016-activity-ownership-strategy.md`). Part 6 (Reports & Dashboard) is the only place in the module permitted to read across all four transactional collections at once, and it does so exclusively to compute — never to store, never to modify. This split was true from Part-6's own review (`docs/ADR-CRM-019-crm-reporting-strategy.md`, `docs/ADR-CRM-020-report-visibility-strategy.md`) forward; this document names it as a standing rule for the module as a whole, now that all six Parts are complete and frozen.

Concretely, this means:

- **Transactional Parts never aggregate.** `CustomerRepository`/`LeadRepository`/`DealRepository`/`ActivityRepository` each query only their own model. None of them ever joins across collections or computes a cross-entity total — that capability lives exclusively in `ReportsRepository`.
- **Reports never writes.** `ReportsRepository`/`ReportsService`/`ReportsController` have no `create`/`update`/`archive` method anywhere, and no domain event either — nothing in Part-6 changes the state of a Customer, Lead, Deal, or Activity, directly or indirectly.
- **Reports never becomes a second source of truth.** No forecast value, KPI, or dashboard number is ever persisted (`docs/ADR-CRM-019`'s BR-004 discussion) — every response is computed fresh from the four transactional collections at request time. There is exactly one place `Deal.value`, `Lead.status`, or `Activity.dueDate` live; Reports reads them, never copies them.

## Why this is worth stating as its own, permanent rule

Volume-6 itself asked for "Future compatibility with Billing and Platform Reporting" (§14 of its own review scope) — meaning this boundary needs to hold up against modules that don't exist yet, not just the five that do. A future Billing module, or a platform-wide Reporting module (D010's own, broader "Reports" entry, distinct from this CRM-scoped Volume-6 slice — see the Dependencies-list distinction noted during Part-6's review), will each face the same question Part-6 already answered: does a new analytical or cross-module concern get its own read-only aggregation layer, or does it reach into and duplicate another module's transactional data? This document's answer, established here, is the same answer CRM gave itself: read-only aggregation over the transactional module's own repository/model, never a duplicate copy, never a write path back into it.

## What's now closed

With Part-6 approved and frozen, the CRM module (Phase-5, all six Parts) is complete: `customers`, `leads`, `deals`, `activities` as the four permanent transactional collections, and `crm/reports/*` as the one permanent analytical read layer over all of them. No further Parts are queued under PRD-004 — the next module is whatever the Product Owner/Architect names next in the Software Development Plan.
