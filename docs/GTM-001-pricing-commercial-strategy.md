# GTM-001 — Pricing & Commercial Strategy

**Status:** Draft — Commercial figures require Product Owner sign-off before publication
**Governance:** Intentionally outside PRD/ADR/SAD governance, per the decision made during PRD-005 review — this document can change without a Product Requirement update or version increment to any PRD. It may itself be versioned independently.

**Important note on this document's scope:** Every _policy_ below (trial terms, grace period, GST logic, upgrade/downgrade rules, cancellation behavior) is not new — each is pulled directly from an already-approved Business Decision or ADR, cited inline. The actual **₹ price points are placeholders**, marked clearly below. I have not fabricated final commercial numbers and presented them as decided — real pricing requires competitive benchmarking (Interakt/WATI/AiSensy current pricing), Meta's own conversation-pricing exposure at launch, and target unit economics that are business judgment calls, not something I can responsibly invent. The structure is complete and ready to receive real numbers; the numbers themselves need your (and the Architect's) confirmation before this goes live anywhere, including the Pricing page.

---

## 1. Plan Structure

Three tiers, per PRD-005's approved tier names (Starter / Growth / Enterprise) and the "all plans get full feature access, tiers differ only by usage limits" rule (PRD-005 v1.2 §I).

|                                                | Starter                                                     | Growth                           | Enterprise                           |
| ---------------------------------------------- | ----------------------------------------------------------- | -------------------------------- | ------------------------------------ |
| **Monthly Price**                              | `[PLACEHOLDER — e.g. ₹1,499/mo]`                            | `[PLACEHOLDER — e.g. ₹3,999/mo]` | Custom (sales-assisted)              |
| **Annual Price**                               | `[PLACEHOLDER — typically 15–20% discount vs. 12× monthly]` | `[PLACEHOLDER]`                  | Custom                               |
| **Included Users**                             | 5                                                           | 20                               | Custom                               |
| **WhatsApp Numbers**                           | 1                                                           | 3                                | Custom                               |
| **Broadcast Limit**                            | 1,000 / campaign                                            | 10,000 / campaign                | Custom                               |
| **CRM / Analytics / Shared Inbox / Templates** | Included (all plans)                                        | Included                         | Included                             |
| **Support**                                    | Standard                                                    | Standard                         | Priority + Dedicated Success Manager |

Source for the non-price rows: PRD-005 v1.2 §I (Phase-1 Plan Feature Matrix) — restated here verbatim, not re-derived.

**Recommendation for setting the placeholder numbers:** benchmark against Interakt/WATI/AiSensy's current public pricing for equivalent tiers, then position Starter competitively (this is the self-serve entry point competing on the "easiest to start" USP, D008) while Growth/Enterprise can carry a premium justified by the CRM depth and Automation/SLA capabilities competitors in this price band typically lack. This is a recommendation on _how_ to set the number, not the number itself.

---

## 2. Trial Policy

Per **Decision 007** and **ADR-007/TRIAL-BR-002**: 14 calendar days, no credit card required, trial clock starts at successful Workspace creation (not registration) — protects trial-day count from email-verification delivery delay.

- **One trial per business**, enforced via the account-uniqueness rule (unique email + unique mobile, PRD-002 REG-BR-002/003) — per the earlier-flagged open question, this is enforced at the _account_ level; genuine multi-account abuse by the same real business using different staff emails/phones is a known, accepted residual risk (not solved by Phase-1 architecture), consistent with how Decision Log risks are generally handled — named, not necessarily eliminated.
- **Manual extension:** Platform Super Admin only, requires reason + approval + audit entry, maximum one extension per Workspace (PRD-005 §A, PRD-007 Vol 2 Module E).

---

## 3. Upgrade Policy

Per PRD-005 §H: available anytime, new limits apply immediately, prorated billing calculated at time of upgrade (standard SaaS proration — the _mechanism_ of proration itself is an implementation detail for Architecture, not a business policy needing definition here, since "Auto Proration" beyond the basic upgrade-immediacy rule was explicitly named Out of Scope for Phase-1 in PRD-005 — meaning upgrades take effect immediately, but complex mid-cycle proration math is deliberately kept simple/manual for Phase-1).

## 4. Downgrade Policy

Per PRD-005 §I: becomes effective from the next billing cycle — never mid-cycle, avoiding any refund-adjacent complexity given Refund Automation is also Out of Scope (PRD-005 Out of Scope list).

## 5. Cancellation Policy

Per PRD-005 §K and ADR-020: workspace remains active until the current billing period ends; then enters 90-day Read-Only retention (restorable); permanent deletion after 90 days, no recovery possible thereafter.

## 6. Commercial Exceptions

Per PRD-007 Vol 2 §F (Commercial Actions): manual plan upgrade/downgrade/activation/suspension by Platform Super Admin only, always requiring Business Reason + Operator Identity + Timestamp + Audit Record. No informal/undocumented pricing exceptions — every deviation from list pricing is a logged, attributable action.

## 7. GST Rules

Per **ADR-026** and **TAD-001 v1.1 §Section 8 GST invoice model**:

- GST Number is optional at the Workspace level.
- If provided → GST-compliant invoice generated (GSTIN, CGST/SGST/IGST breakdown, per the invoice field list already approved).
- If not provided → Non-GST invoice generated.
- Workspace may update GST Number at any time; future invoices pick it up automatically; past invoices remain unchanged (immutability already established).
- **Outstanding item carried forward from PRD-005 review, still open:** the exact invoice field list should get a Chartered Accountant review before production launch (this was already flagged as a required governance gate in PRD-005 §B — restating it here since it directly affects what this document's invoices legally contain, not introducing a new requirement).

## 8. Public Pricing Page Rules

Per PRD-008 Vol 2 §6 and WBR-003/GBR-002/GBR-003:

- Pricing must be publicly visible, no login required to view.
- The website always displays the **currently approved** commercial prices — meaning the Pricing page must read its values from this document (or its eventual real successor with final figures), never hardcode price values into PRD-008/website copy, so a price change never requires a PRD update or a code deploy touching business logic — only a content/config update.
- No Future Phase capability (Usage-Based Billing, Multi-Currency, Partner/Reseller pricing) may be advertised, consistent with PRD-005/PRD-008's Out of Scope lists.

---

## 9. Change Control for This Document

Unlike the PRDs, GTM-001 does **not** require an ADR to change a price point — that's the entire reason it was decoupled (PRD-005 review). It **does** require an ADR if a change would alter a _policy_ already sourced from an approved decision above (e.g., changing the trial length, changing the grace-period schedule, changing the GST logic) — those remain governed by the Business Decision Log, not this document, and GTM-001 should be updated to match if they ever change, not the reverse.

---

## Open Item

**The placeholder price points in Section 1 need real figures before the Pricing page (PRD-008) or any billing UI can be considered feature-complete.** This does not block backend/CRM/Auth/Communication development — none of that depends on the actual number — but it does block M5 (Billing) and M7 (Public Website) in SDP-001's milestone plan from fully closing.
