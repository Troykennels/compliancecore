# ComplianceCore plan gating, catalogue 2026.2

Implements `ComplianceCore_AI_Feature_Gating_Implementation_Prompt_2026.pdf` on branch `ux-fixes-20261029` (the live code, with Compliance journey, the privacy modules and Client portfolio). Prices come from market research (section 2) and stay editable in Billing Admin; every edit is recorded.

## 1. Discovery summary

- **Stack:** Express + Prisma/raw SQL. There is a `global` schema plus one schema per organisation (tenant). Billing tables are created at boot (`initBillingTables`).
- **Already present before this work:**
  - trial, active, grace and read-only states;
  - writes blocked after grace;
  - user, framework, evidence, branch and department limits;
  - Paystack checkout with verified and idempotent settlement;
  - part payments;
  - recurring billing only with explicit consent;
  - expiry reminders at 7, 3 and 1 days;
  - the OLM deployment licence (`orionLicense.ts`, fails open);
  - the OLM renewal feed (`/api/payments/renewal-overview`);
  - role permissions (RBAC) and tenant isolation.
- **Missing:**
  - module locks (every plan had every module);
  - refunds and disputes (ignored);
  - 14-day and due-date reminders;
  - suspended, cancelled and expiring states;
  - an AI usage allowance;
  - plan history;
  - organisation branding beyond name and logo.
- **Placeholder found:** the old logo upload saved a temporary `blob:` URL and accepted SVG. It has been replaced (section 6).
- **Partial:** Client portfolio has no API of its own. It lists the user's own memberships and switches between them, so its lock is a screen-level lock. Each organisation's own plan applies after switching.

## 2. Plan-module matrix (owner-editable)

| | Essential | Growth | Professional | Business | Enterprise |
|---|---|---|---|---|---|
| Price | N35,000/mo, N350,000/yr | N75,000 / N750,000 | N150,000 / N1,500,000 | N300,000 / N3,000,000 | quoted, from N6,000,000/yr |
| One-time onboarding | none | N100,000 | N250,000 | N500,000 | from N1,500,000 |
| Onboarding waived when paying yearly | n/a | yes | yes | yes | no (quoted) |
| Team members | 3 | 10 | 25 | 50 | unlimited |
| Frameworks | 2 | 3 | 5 | unlimited | unlimited |
| Evidence storage | 5 GB | 20 GB | 50 GB | 150 GB | unlimited |
| Journey, dashboard, guide, scope, assessments, controls, policies, evidence, tasks, calendar, expiry tracker, basic reports, compliance score, branding, billing, **records of processing, data subject requests, incident register** | yes | yes | yes | yes | yes |
| Risk assessment, policy templates, approvals, training, impact assessments, analytics (enhanced reporting) | - | yes | yes | yes | yes |
| Audits and audit room, signatures, vendors, escalations, AI tools | - | - | yes (AI 100 requests/month) | yes (AI 500/month) | yes |
| Client portfolio, scheduled (advanced) reports, integrations | - | - | - | yes | yes |

**Why these prices (research, 12 November 2026).** Foreign compliance tools start at about $7,500-$15,000 a year for one framework (Vanta, Drata, Secureframe, Sprinto, Scrut); OneTrust's privacy suite is about $44,000 a year. In Nigeria, Asiri (NDPA only) lists N900,000-N6,000,000 a year, and outsourced DPO services start at about N600,000 a month. These plans sit below Asiri while covering far more, and below the October 2026 prices (Starter N40,000/mo plus N1,500,000 onboarding).

**Why this placement.** Nigerian buyers come for the Nigeria Data Protection Act, so its basics (records of processing, data subject requests, an incident register for the 72-hour breach notice) are in every plan. Upgrades are driven by team size, frameworks, storage, impact assessments, audits, vendors, AI and multi-client work.

**First-customer offer.** Use a Billing Admin coupon (for example 40% off, limited uses, an expiry date, the 2026 plan slugs). A coupon applies to the plan the organisation is on when it is applied; it never discounts onboarding.

Earlier plans (Starter, Professional, Business, Enterprise, MSP) are **withdrawn from new sales only**. They stay active and have no module list, so every module stays open. Customers on them keep their contracted entitlements and prices (grandfathered).

## 3. Three access controls on every request

1. **Plan.** `enforceEntitlement` runs on every module router and refuses a locked module with 402 `PLAN_UPGRADE_REQUIRED`.
   - **Most modules:** viewing and exporting existing records stays allowed; nothing new can be created or changed.
   - **AI, analytics and policy templates:** every request is refused, because reading is the feature.
   - **Background jobs** (scheduled reports, escalations, approval deadlines) skip locked modules.
2. **Role.** Existing RBAC is unchanged. Only users with `billing:write` can pay; everyone else gets "ask my administrator" (`POST /api/billing/upgrade-request`).
3. **Tenant.** The organisation always comes from the sign-in token, never from a client-supplied id.

Other rules:
- **Withdrawn or quoted plans** cannot be bought or switched to unless they are the organisation's current plan (`PLAN_NOT_AVAILABLE`). This blocks switching onto an old cheaper plan, which has every module open.
- **Fail-safe.** If the plan lookup fails, plan modules answer 503 `ENTITLEMENT_UNAVAILABLE` and never unlock; core work fails open, as before.

## 4. Subscription states and countdown

| State | Access |
|---|---|
| trialing, active | full |
| expiring (14 days or less left) | full |
| grace (7 days after the end) | full |
| read_only (past grace) | view and export only |
| suspended (paused by Orion Soft) | view and export only |
| cancelled (past grace) | view and export only |

- The server computes the countdown in UTC (`hoursRemaining`); the browser only displays it.
- **Reminders** go out at 14, 7, 3 and 1 days and on the due date (Lagos calendar), each sent once and recorded in `subscription_reminders`.

## 5. Paystack

- `refund.*` and `charge.dispute.*` events are recorded once each in `global.payment_issues` and emailed to `BILLING_NOTIFY_EMAIL` (or support). Access is **never** changed automatically; the owner reviews them in Billing Admin, Payment issues.
- Webhooks with a bad signature are refused and recorded (at most one row per minute).

## 6. Branding (every plan)

- **Fields:** legal name, footer line, brand colour, logo and letterhead image.
- **Images:** PNG or JPEG only, under 350 KB, and the real bytes must match the declared type. No SVG, no scripts, and no server fetching a customer-supplied URL.
- **Where it appears:**
  - the executive report PDF (scheduled reports too);
  - policy and compliance-record Word downloads;
  - the "Bill to" block of invoices (ORION SOFT stays the issuer).
- ComplianceCore attribution is kept on every document.
- **Old logo field:** the legacy `logoUrl` now accepts only https links that are not SVG.

## 7. API and database changes

- **Plans:** `subscription_plans` gains `modules jsonb`, `catalog_version` and `max_ai_requests_monthly`.
- **New tables:**
  - `subscription_plan_history` (snapshot before every owner edit);
  - `ai_usage`;
  - `upgrade_requests`;
  - `payment_issues`.
- **Tenants:** `tenants` gains `legal_name`, `footer_text`, `brand_color`, `brand_logo` and `letterhead_image`.
- **New routes:**
  - `GET/PUT /api/organizations/branding`;
  - `POST /api/billing/upgrade-request`;
  - `GET /api/billing/admin/plans/:id/history`;
  - `GET /api/billing/admin/payment-issues` and `POST .../:id/resolve`.
- `/api/billing/entitlement` adds `lockedModules`, `hoursRemaining`, `aiRequestsMonthly` and `aiRequestsUsed`.
- **How changes apply:**
  - The catalogue is applied once, guarded by schema_migrations `016_plan_catalog_2026_2`; owner edits survive restarts.
  - Columns are added idempotently on every boot.

## 8. Rollout and rollback

1. Back up the database.
2. Deploy. The catalogue applies, and new sign-ups trial on Professional (2026). Existing customers are unaffected (grandfathered).
3. **Staged or instant rollback:** set `PLAN_MODULE_LOCKS=off` and restart. Locks are off; prices, limits and states are unchanged.
4. **Full rollback:** redeploy the previous build. The new columns and tables are additive and ignored by older code. To put the earlier catalogue back on sale, set `is_public = true` on those plans in Billing Admin.

## 9. Tests

- **Backend:** 258 tests pass on an isolated database (`compliance_renewal_task_*`), including `test/integration/plan-gating.test.ts` (19). It covers:
  - the catalogue and grandfathering;
  - locks by plan, role and tenant, including direct API calls;
  - background jobs;
  - states;
  - checkout and switch eligibility;
  - the AI allowance and its refund on failure;
  - reminders;
  - refunds, disputes and forged webhooks;
  - plan history;
  - upgrade requests;
  - branding validation and isolation;
  - the fail-safe and the rollout switch.
- **Frontend:** type-check, lint and production build pass. The browser check (Edge, fake API) passed 22/22 for an owner and a viewer:
  - lock icons and the locked page with the price;
  - asking an administrator;
  - the read-only view of existing records;
  - the plan comparison;
  - saving branding and its preview;
  - phone width;
  - no page errors.

## 10. Not done, flagged

- **Add-ons:** none are sold yet; any future add-on needs its own entitlement and price, as the prompt says.
- **Client portfolio:** lock is screen-level only (no API of its own); see section 1.
- **Owner sign-off:** prices and the module allocation are drafts in the database, awaiting product-owner sign-off. Change them in Billing Admin, Plans; edits are logged.
