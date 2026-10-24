# C&I presentation release verification — 24 October 2026

Application source: `ef774ece6cf1a87ea08d5472e60c7b7a8b6d7f5e`.

Published application: https://compliancecore-sand.vercel.app

## Changes delivered

- Replaced the fixed-coordinate invoice with a measured PDF layout: Orion letterhead, recipient, invoice reference and dates, readable currency columns, long-description continuation, repeated table headers, page numbers and separate totals. Draft, paid, partial and void cases have appropriate wording. Demonstration invoices explicitly cannot request payment.
- The first demo invoice separates the illustrative NGN 5,000,000 Enterprise onboarding fee and NGN 4,800,000 annual subscription. Subsequent sample renewals exclude onboarding; the monthly sample now has a one-month service period. Existing real subscriptions and prices were not altered by this task.
- Tailored the managed demonstration to C&I Leasing Plc's published business lines. Updated 80 existing demo records, added three sample branch locations and six new downloadable evidence versions. Earlier policy and evidence versions remain in history. Framework requirements were preserved; implementation notes describe proposed use, not certification.
- Added an expandable in-app guide with business-line examples and links, plus the detailed [presentation walkthrough](CI_LEASING_DEMO_WALKTHROUGH.md).
- Updated only the managed demo owner's password through the normal application password-change flow. Previous sessions were revoked and the new login verified. The private access file holds the password; no credentials are committed to source.

## Release evidence

Railway deployment `0b7a2c3f-adff-47da-849b-e3fa899014b9` succeeded. The compiled invoice module's SHA-256 matches the tested local build. Readiness confirms PostgreSQL and Redis up.

Vercel deployment `dpl_GN6N3oxQUEdVLcJ9P5fm7eA7bnma` is ready and promoted. The public `compliancecore-sand.vercel.app` alias was verified against that exact deployment.

GitHub CI run [40073349805](https://github.com/Troykennels/compliancecore/actions/runs/40073349805) passed backend type checking, build, unit/integration tests and the HTTP journey; frontend lint, type checking and build; and both Docker builds.

Local PDF verification passed seven fixtures spanning 37 pages, including 65 service rows, an extremely long description, a long invoice reference, large values, partial payment, paid and void states. Independent rendered-text checks found no overlapping text or text outside page bounds. The actual invoice downloaded from the live application also passed, on one page, with the correct recipient and amounts. Both the fixture and live invoice were inspected visually.

The revised demo passed 39 local API checks and 40 live API checks, including all six current evidence downloads and SHA-256 checksums, preserved versions, invoice rows and genuine signature creation/verification. The tailored seed skipped safely on its second local and live run.

The actual public application passed 74 browser checks with zero runtime/page/overflow errors: all 35 routes at widths 1440 and 390, monthly/annual non-payable demo quotes and persisted sound opt-in. The expanded in-app guide also passed at both widths: four correct business-line links, fictional-data notice, no horizontal overflow and actual navigation from the fleet link. Desktop/mobile screenshots and machine-readable results are retained locally in `verification/ci-presentation-20261024/`.

All ten non-demo customer subscription records matched the snapshot captured before this task's live demo update. One `next_invoice_amount` already differed from the prior day's snapshot before this release's database changes; that pre-existing value was retained. A fresh private database archive was taken before changing the live demo.

## Operational boundaries

The first local API verification hit a Prisma transaction-start timeout while this workstation was also building and running browser checks; it passed after the build finished. A cold development-server browser check timed out, and a local preview built with the default localhost:3002 API setting could not log in to the isolated port:3008 fixture. These attempts are not counted as passes. Final acceptance uses the actual public deployment and configured production API.

The existing automatic GitHub deployment credentials still need replacement by the account owner. This release was published and verified using the authenticated local provider CLIs. No token-creation bypass was attempted. Development/build dependency advisories remain as documented in the previous release; this task introduced no dependency changes.

No real client payment, email, SMS or operational integration was triggered. The demonstration remains non-payable, example scheduled reports/escalations are disabled, and company scenarios are explicitly fictional. Live device sound still depends on browser and operating-system permissions. These checks do not establish regulatory certification or guarantee the absence of every possible defect.
